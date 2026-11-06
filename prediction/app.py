"""Internal inference API. Loads a trained data-only Decision Tree once at startup."""
from contextlib import asynccontextmanager
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

FEATURES = ["severity", "rule_family", "category", "language", "file_type", "rule_count_in_scan",
            "repository_criticality", "exposure", "impact"]
Priority = Literal["High", "Medium", "Low"]


class Features(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    severity: Priority
    rule_family: Annotated[str, Field(min_length=1, max_length=256)]
    category: Literal["Security", "Coding standard", "Code quality", "Manual review", "unknown"]
    language: Literal["python", "javascript", "typescript", "go", "unknown"]
    file_type: Annotated[str, Field(min_length=1, max_length=16)]
    rule_count_in_scan: Annotated[int, Field(ge=1, le=1000)]
    repository_criticality: Literal["high", "normal", "low", "unknown"]
    exposure: Literal["public", "authenticated", "internal", "test_only", "unknown"]
    impact: Literal["high", "medium", "low", "unknown"]


class Item(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fingerprint: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    features: Features


class Batch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: Annotated[list[Item], Field(min_length=1, max_length=1000)]


class TreeModel:
    def __init__(self, path):
        raw = Path(path).read_bytes()
        if len(raw) > 1_000_000:
            raise ValueError("Model artifact exceeds limit")
        self.data = data = json.loads(raw)
        if (data["schema_version"] != "auditorx-tree-v1" or data["features"] != FEATURES
                or data["feature_contract"] != "priority-features-v1"
                or data["human_ground_truth"] is not False or data["dataset_kind"] != "simulated_source_lab"
                or set(data["classes"]) != {"High", "Medium", "Low"}
                or not 1 <= len(data["nodes"]) <= 256):
            raise ValueError("Unsupported model contract")
        self.digest = hashlib.sha256(raw).hexdigest()
        visited = set()

        def visit(index):
            if index in visited or not 0 <= index < len(data["nodes"]):
                raise ValueError("Invalid tree topology")
            visited.add(index)
            node = data["nodes"][index]
            if len(node["values"]) != 3 or not all(math.isfinite(v) and v >= 0 for v in node["values"]) or sum(node["values"]) <= 0:
                raise ValueError("Invalid leaf scores")
            if node["left"] == node["right"] == -1:
                return
            if not 0 <= node["feature"] < len(data["encoded_features"]) or not math.isfinite(node["threshold"]):
                raise ValueError("Invalid tree split")
            feature = data["encoded_features"][node["feature"]].split("=", 1)[0]
            if feature not in FEATURES:
                raise ValueError("Unexpected feature")
            visit(node["left"]); visit(node["right"])
        visit(0)
        if len(visited) != len(data["nodes"]):
            raise ValueError("Unreachable tree nodes")

    def predict(self, features):
        row, index = features.model_dump(), 0
        while True:
            node = self.data["nodes"][index]
            if node["left"] == -1:
                return self.data["classes"][max(range(3), key=lambda i: node["values"][i])]
            name = self.data["encoded_features"][node["feature"]]
            if "=" in name:
                key, category = name.split("=", 1)
                value = float(row[key] == category)
            else:
                value = row[name]
            index = node["left"] if value <= node["threshold"] else node["right"]

    def metadata(self):
        return {"model_version": self.data["model_version"], "model_sha256": self.digest,
                "feature_contract": "priority-features-v1", "experimental": True,
                "dataset_kind": "simulated_source_lab", "training_rows": self.data["training_rows"]}


def create_app(model_path=None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.model = TreeModel(model_path or os.environ.get("MODEL_PATH", "/models/service-model.json"))
        yield

    app = FastAPI(title="AuditorX experimental prediction", lifespan=lifespan)

    @app.middleware("http")
    async def limit_body(request: Request, call_next):
        if request.method == "POST":
            try:
                size = int(request.headers.get("content-length", "-1"))
            except ValueError:
                size = -1
            if size < 0:
                return JSONResponse({"detail": "Content-Length is required"}, status_code=411)
            if size > 1_048_576:
                return JSONResponse({"detail": "Request exceeds 1 MiB"}, status_code=413)
        return await call_next(request)

    @app.get("/health")
    def health():
        return {"status": "ready", **app.state.model.metadata()}

    @app.post("/predict")
    def predict(batch: Batch):
        if len({item.fingerprint for item in batch.items}) != len(batch.items):
            raise HTTPException(422, "Duplicate finding fingerprints")
        return {**app.state.model.metadata(), "predictions": [
            {"fingerprint": item.fingerprint, "priority": app.state.model.predict(item.features)}
            for item in batch.items]}

    return app


app = create_app()
