from test_query import Parser

def get_selector(node):
    path = []
    curr = node
    while curr and curr.tag != "root_doc" and curr.tag != "html" and curr.tag != "body":
        if curr.parent:
            # find index among siblings of same tag
            same_tag = [c for c in curr.parent.children if c.tag == curr.tag]
            idx = same_tag.index(curr) + 1
            path.append(f"{curr.tag}:nth-of-type({idx})")
        else:
            path.append(curr.tag)
        curr = curr.parent
    path.reverse()
    # add div#root at the start if first is div:nth-of-type(1)
    if path and path[0] == "div:nth-of-type(1)":
        path[0] = "div#root:nth-of-type(1)"
    return " > ".join(path)

# Let us check across all tabs rendered:
import subprocess

tabs = ["users", "notifications", "allgemein", "arbeitseinsaetze", "rules", "sperren", "layout", "database"]
target_sel = "div#root:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2)"

print(f"Target selector:\n{target_sel}\nLength: {len(target_sel.split(' > '))}")

with open("test_output.html", "r", encoding="utf-8") as f:
    content = f.read()

p = Parser()
p.feed(content)

def check_all(node):
    sel = get_selector(node)
    if sel == target_sel:
        print("EXACT MATCH FOUND IN CURRENT HTML!")
        print(f"Tag: {node.tag}, class: {node.get_class()}, text: {node.text.strip()[:100]}")
        return True
    for ch in node.children:
        if check_all(ch):
            return True
    return False

if not check_all(p.root):
    print("Not found in 'users' tab. Testing other tabs or configurations...")
