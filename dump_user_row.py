import sys
from test_query import Parser, p

body = [c for c in p.root.children if c.tag == "html"][0]
body = [c for c in body.children if c.tag == "body"][0]

# Let us navigate to the user rows container:
curr = body
path_steps = [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 3, 2]
for idx, s in enumerate(path_steps):
    matches = [c for c in curr.children if c.tag == ("main" if idx == 2 else "div")]
    curr = matches[s - 1]

print("At user rows container:", curr.get_class())
for user_idx, user_row in enumerate([c for c in curr.children if c.tag == "div"]):
    print(f"\nUser row {user_idx + 1}:")
    for col_idx, col in enumerate([c for c in user_row.children if c.tag == "div"]):
        print(f"  Col {col_idx + 1} ({col.get_class()[:30]}):")
        def dump_tree(node, indent="    "):
            div_children = [c for c in node.children if c.tag == "div"]
            print(f"{indent}<{node.tag} class='{node.get_class()[:40]}'> text: '{node.text.strip()[:30]}'")
            for ch in node.children:
                dump_tree(ch, indent + "  ")
        dump_tree(col)
