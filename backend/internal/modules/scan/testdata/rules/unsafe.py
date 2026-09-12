import logging
import subprocess


def unsafe(cursor, user_input):
    api_key = "production-secret-value"
    logging.info("credential: %s", api_key)
    eval(user_input)
    subprocess.run(user_input, shell=True)
    cursor.execute(f"SELECT * FROM users WHERE id = {user_input}")


def safe(cursor, user_input):
    api_key = load_secret("API_KEY")
    logging.info("request completed")
    subprocess.run(["tool", user_input], check=True)
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_input,))
