hullojsa Mikkel

# Manual Test: Sending Test Email to Local Worker

This directory contains a test script (`test_email.py`) for sending emails to a locally running Cloudflare Email Worker.

## Quickstart with [`uv`](https://github.com/astral-sh/uv)

1. Ensure [`uv`](https://github.com/astral-sh/uv) is installed (`pip install uv`).

2. Install dependencies locally (isolated from global Python packages):

   ```
   uv install
   ```

   *(If there is no `requirements.txt`, standard library and [requests](https://pypi.org/project/requests/) are needed. Install via: `uv pip install requests`)*

3. Run the test email script:

   ```
   uv run python test_email.py
   ```

**Note**: Make sure your local worker is running at [http://localhost:8787/cdn-cgi/handler/email](http://localhost:8787/cdn-cgi/handler/email) before testing.
