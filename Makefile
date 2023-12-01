BUN = bun
BUNX = bunx --bun

MD2DOCX = $(BUN) ./bin/index.ts

debug:
	$(MD2DOCX) convert --output=./build/debug.docx ./example/main.md

dep:
	$(BUN) install

dep.update:
	$(BUNX) npm-check-updates --root -ui

test:
	bun test

pub:
	$(BUNX) @morlay/bunpublish

lint:
	$(BUNX) prettier --write .

clean:
	find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \;