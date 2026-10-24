"""Makes the iOS diff sources compile on macOS: UIKit becomes AppKit plus Stubs.swift,
and blocks and their lines keep their NSAttributedStrings."""
import sys

work = sys.argv[1]

path = f"{work}/DiffHighlighter.swift"
src = open(path).read()
src = src.replace("import UIKit", "import AppKit")
open(path, "w").write(src)

path = f"{work}/DiffRendering.swift"
src = open(path).read()
src = src.replace("import SwiftUI\n", "").replace("import UIKit", "import AppKit")
for old, new in [
    ("let gutter: AttributedString", "let gutter: NSAttributedString"),
    ("let code: AttributedString", "let code: NSAttributedString"),
    ("let empty = AttributedString()", "let empty = NSAttributedString()"),
    ("gutter: AttributedString(gutter)", "gutter: gutter"),
    ("code: AttributedString(code)", "code: code"),
]:
    assert old in src, old
    src = src.replace(old, new)
open(path, "w").write(src)
