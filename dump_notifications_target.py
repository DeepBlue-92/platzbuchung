from test_query import Parser
from find_exact import get_selector

with open("test_notifications.html", "r", encoding="utf-8") as f:
    html = f.read()

p = Parser()
p.feed(html)

prefix = "div#root:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2)"

def find_by_sel(node):
    if get_selector(node) == prefix:
        return node
    for ch in node.children:
        res = find_by_sel(ch)
        if res: return res
    return None

target = find_by_sel(p.root)
print("Found target node at prefix:")
print(f"Tag: {target.tag}, class: '{target.get_class()}'")

def dump_subtree(node, depth=0):
    sel = get_selector(node)
    indent = "  " * depth
    text = node.text.strip().replace("\n", " ")[:60]
    print(f"{indent}[{depth}] <{node.tag} class='{node.get_class()[:40]}'> text: '{text}'")
    print(f"{indent}    Full Selector: {sel}")
    for ch in node.children:
        dump_subtree(ch, depth + 1)

dump_subtree(target)
