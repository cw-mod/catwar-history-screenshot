import re

with open('/home/z/my-project/download/catwar-history-screenshot.user.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all console.info(...) blocks (multi-line)
content = re.sub(r'console\.info\([^)]*\);', '', content, flags=re.DOTALL)
# Also remove orphaned object properties left behind
# Clean up multiple blank lines
content = re.sub(r'\n{3,}', '\n\n', content)

# Remove standalone comment lines (// at start, after whitespace)
lines = content.split('\n')
result = []
in_header = False
for line in lines:
    if '// ==UserScript==' in line:
        in_header = True
        result.append(line)
        continue
    if '// ==/UserScript==' in line:
        in_header = False
        result.append(line)
        continue
    if in_header:
        if '@version' in line:
            result.append('// @version      1.0.0')
        elif '@author' in line:
            result.append('// @author       кошечка')
        elif '@description' in line:
            result.append('// @description  Скриншот истории CatWar с бейджем времени по МСК')
        else:
            result.append(line)
        continue
    
    stripped = line.strip()
    # Skip pure comment lines
    if stripped.startswith('//') and not stripped.startswith('// =='):
        continue
    
    # Remove inline comments but preserve URLs
    if 'http://' in line or 'https://' in line or 'wss://' in line:
        result.append(line)
        continue
    
    # Find // outside strings
    in_str = False
    str_ch = None
    esc = False
    comment_idx = -1
    for j, ch in enumerate(line):
        if esc:
            esc = False
            continue
        if ch == '\\':
            esc = True
            continue
        if in_str:
            if ch == str_ch:
                in_str = False
        else:
            if ch in '"\'`':
                in_str = True
                str_ch = ch
            elif ch == '/' and j + 1 < len(line) and line[j + 1] == '/':
                comment_idx = j
                break
    
    if comment_idx >= 0:
        line = line[:comment_idx].rstrip()
    
    if line.strip():
        result.append(line)

with open('/home/z/my-project/download/catwar-history-screenshot.user.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(result) + '\n')

print(f"Done: {len(result)} lines")
