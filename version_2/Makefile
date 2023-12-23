.PHONY: build watch serve

build:
	rm -rf build
	./node_modules/typescript/bin/tsc
	cp static/* build/

watch:
	./node_modules/typescript/bin/tsc -w

serve:
	npx serve build/
