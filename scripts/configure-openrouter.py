#!/usr/bin/env python3
"""Read the key without echo, save a private dev file, and upload the Worker Secret."""
from pathlib import Path
import argparse
import getpass
import os
import re
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
path = root / 'services/model-api/.dev.vars'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--saved', action='store_true', help='重试上传已保存在本地私有文件的密钥')
args = parser.parse_args()
if args.saved:
    if not path.exists():
        sys.exit('本地尚未保存密钥，请先不带 --saved 运行。')
    key = next((line.split('=', 1)[1].strip() for line in path.read_text().splitlines() if line.startswith('OPENROUTER_API_KEY=')), '')
else:
    key = getpass.getpass('OpenRouter API Key（输入隐藏）: ').strip()
if not re.fullmatch(r'sk-or-[A-Za-z0-9_-]{20,}', key):
    sys.exit('格式不符合 OpenRouter Key，请重新执行；未写入或上传。')
existing = path.read_text() if path.exists() else ''
lines = [line for line in existing.splitlines() if not line.startswith('OPENROUTER_API_KEY=')]
lines.append('OPENROUTER_API_KEY=' + key)
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.fchmod(fd, 0o600)
with os.fdopen(fd, 'w') as file:
    file.write('\n'.join(lines) + '\n')
print('正在上传至私有 Worker Secret…')
result = subprocess.run([str(root/'node_modules/.bin/wrangler'), 'secret', 'put', 'OPENROUTER_API_KEY', '--config', str(root/'services/model-api/wrangler.jsonc')], input=key+'\n', text=True, cwd=root)
key = ''
if result.returncode:
    sys.exit('上传失败；密钥保留在已忽略的本地私有文件，修复登录后重新执行。')
print('已保存并上传。请重新打开 Toy 游戏；真实模型结果仍需完成一次联网验收。')
