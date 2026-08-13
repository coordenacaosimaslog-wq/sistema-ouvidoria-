import re

with open('C:\\Users\\Iara Silva Moreira\\.gemini\\antigravity\\scratch\\reclamacao-do-cliente\\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.finditer(r'<select.*?id=[\'\"]status[\'\"].*?>.*?</select>', text, re.DOTALL)
for m in matches:
    print(m.group(0))
