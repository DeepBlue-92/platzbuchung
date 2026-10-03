import os
from test_query import Parser
from find_exact import get_selector, target_sel

tabs = ["notifications", "users", "allgemein", "arbeitseinsaetze", "rules", "sperren", "layout", "database"]

target_parts = target_sel.split(" > ")

for tab in tabs:
    fname = f"test_{tab}.html"
    if not os.path.exists(fname): continue
    with open(fname, "r", encoding="utf-8") as f:
        html = f.read()
    p = Parser()
    p.feed(html)
    
    found = []
    def check_node(node):
        sel = get_selector(node)
        if sel == target_sel:
            found.append(node)
        else:
            # check common prefix length
            parts = sel.split(" > ")
            match_len = 0
            for a, b in zip(parts, target_parts):
                if a == b: match_len += 1
                else: break
            if match_len >= 14:
                # print partial matches
                pass
        for ch in node.children:
            check_node(ch)
            
    check_node(p.root)
    if found:
        print(f"*** FOUND EXACT MATCH in {tab}! Count: {len(found)} ***")
        for node in found:
            print(f"Tag: <{node.tag}>, class: '{node.get_class()}', text: '{node.text.strip()}'")
            print("Children:")
            for ch in node.children:
                print(f"   <{ch.tag} class='{ch.get_class()}'> text: '{ch.text.strip()}'")
    else:
        # find deepest prefix match in this tab
        deepest = [0, None, ""]
        def find_deepest(node):
            sel = get_selector(node)
            parts = sel.split(" > ")
            match_len = 0
            for a, b in zip(parts, target_parts):
                if a == b: match_len += 1
                else: break
            if match_len > deepest[0]:
                deepest[0] = match_len
                deepest[1] = node
                deepest[2] = sel
            for ch in node.children:
                find_deepest(ch)
        find_deepest(p.root)
        print(f"Tab '{tab}': max match length {deepest[0]}/{len(target_parts)}")
        if deepest[0] >= 14:
            print(f"   Matched up to: {deepest[2]}")
            print(f"   Node: <{deepest[1].tag} class='{deepest[1].get_class()[:40]}'> text: '{deepest[1].text.strip()[:40]}'")
