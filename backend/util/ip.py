import re
import subprocess

cached_ip = None

def get_windows_ip():
    global cached_ip
    if cached_ip is not None:
        return cached_ip
    try:
        # Ensure the working directory is valid for Windows
        working_directory = "/mnt/c/Windows/System32"

        # Run ipconfig from CMD
        result = subprocess.check_output(
            ["/mnt/c/Windows/System32/cmd.exe", "/c", "ipconfig"],
            text=True,
            cwd=working_directory  # Set working directory
        )

        # Extract IPv4 address from the Wi-Fi adapter
        match = re.search(r"IPv4 Address[.\s]+:\s(\d+\.\d+\.\d+\.\d+)", result)
        if match:
            cached_ip = match.group(1)
            # print(cached_ip)
            return cached_ip
        return "Windows IP not found"
    except Exception as e:
        return f"Error retrieving Windows IP: {e}"
