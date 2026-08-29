package scan

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

func containProcess(cmd *exec.Cmd) {
	cmd.Cancel = func() error {
		// Terminate the owned Semgrep process tree, not only the Python launcher.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		killer := exec.CommandContext(ctx, filepath.Join(os.Getenv("SystemRoot"), "System32", "taskkill.exe"), "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))
		if err := killer.Run(); err != nil {
			return cmd.Process.Kill()
		}
		return nil
	}
}
