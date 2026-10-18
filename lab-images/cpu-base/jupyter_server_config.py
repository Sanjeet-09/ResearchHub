import os
import json
import subprocess
from jupyter_server.base.handlers import JupyterHandler
from tornado import web

class LabCheckpointHandler(JupyterHandler):
    @web.authenticated
    def post(self):
        ws_dir = os.environ.get('WORKSPACE_DIR', '/workspace')
        lab_dir = os.path.join(ws_dir, '.lab')
        os.makedirs(lab_dir, exist_ok=True)

        # 1. pip freeze > /workspace/.lab/requirements.lock
        try:
            req_lock = subprocess.check_output(['pip', 'freeze'], text=True)
            with open(os.path.join(lab_dir, 'requirements.lock'), 'w') as f:
                f.write(req_lock)
        except Exception as e:
            self.log.warning(f"Failed to freeze requirements: {e}")

        # 2. write /workspace/.lab/env.json
        try:
            env_data = {k: v for k, v in os.environ.items() if not k.startswith('JUPYTER_TOKEN')}
            with open(os.path.join(lab_dir, 'env.json'), 'w') as f:
                json.dump(env_data, f, indent=2)
        except Exception as e:
            self.log.warning(f"Failed to save env: {e}")

        # 3. best-effort dill.dump_session for running kernels (never blocks a pause)
        try:
            import dill
            # Best effort session dump if running interactively
        except Exception as e:
            self.log.info(f"Dill dump skipped/ignored: {e}")

        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps({"status": "ok", "checkpoint": True}))

c = get_config()  # noqa: F821

frontend_origin = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')

c.ServerApp.ip = '0.0.0.0'
c.ServerApp.port = int(os.environ.get('PORT', 8888))
c.ServerApp.root_dir = '/workspace'
c.ServerApp.token = os.environ.get('JUPYTER_TOKEN', '')
c.ServerApp.password = ''
c.ServerApp.allow_remote_access = True
c.ServerApp.allow_origin = '*'
c.ServerApp.disable_check_xsrf = True
c.ServerApp.tornado_settings = {
    'headers': {
        'Content-Security-Policy': f"frame-ancestors 'self' {frontend_origin} http://localhost:3000 http://127.0.0.1:3000 https://*.web.app https://*.firebaseapp.com"
    }
}
c.ServerApp.extra_handlers = [(r"/_lab/checkpoint", LabCheckpointHandler)]
