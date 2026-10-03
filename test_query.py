from html.parser import HTMLParser
import sys

class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag = tag
        self.attrs = dict(attrs)
        self.parent = parent
        self.children = []
        self.text = ""

    def get_id(self):
        return self.attrs.get("id", "")

    def get_class(self):
        return self.attrs.get("class", "")

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = Node("root_doc", {})
        self.current = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        self.current = node

    def handle_endtag(self, tag):
        if self.current.parent:
            self.current = self.current.parent

    def handle_data(self, data):
        self.current.text += data

with open("test_output.html", "r", encoding="utf-8") as f:
    content = f.read()

p = Parser()
p.feed(content)

# Follow the selector
# Selector parts:
parts = [
    ("div", 1), # root
    ("div", 1),
    ("main", 1),
    ("div", 1),
    ("div", 1),
    ("div", 1),
    ("div", 1),
    ("div", 1),
    ("div", 1),
    ("div", 3),
    ("div", 1),
    ("div", 1),
    ("div", 1),
    ("div", 3),
    ("div", 2),
    ("div", 2),
    ("div", 2),
    ("div", 1),
    ("div", 1),
    ("div", 2)
]

def find_node(curr, remaining_parts, depth=0):
    if not remaining_parts:
        print(f"FOUND TARGET ELEMENT! Tag: {curr.tag}, class: {curr.get_class()[:80]}, text: {curr.text.strip()[:100]}")
        # print children
        print("Inner HTML text:")
        print(curr.text.strip())
        return True

    tag, nth = remaining_parts[0]
    # find matching nth-of-type child among curr.children
    matches = [c for c in curr.children if c.tag == tag]
    print(f"Level {depth}: looking for {tag}:nth-of-type({nth}), found {len(matches)} matching tags among {len(curr.children)} children of <{curr.tag} class='{curr.get_class()[:30]}'>")
    if len(matches) < nth:
        print(f"  --> FAILED to find {nth}-th {tag} at level {depth}! (only {len(matches)} found)")
        for idx, m in enumerate(matches):
            print(f"      match[{idx+1}]: <{m.tag} class='{m.get_class()[:50]}'>")
        return False
    target = matches[nth - 1]
    return find_node(target, remaining_parts[1:], depth + 1)

# Start from body -> div#root
body = [c for c in p.root.children if c.tag == "html"][0]
body = [c for c in body.children if c.tag == "body"][0]
find_node(body, parts)
