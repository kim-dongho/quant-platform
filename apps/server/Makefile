# Makefile
.PHONY: swag run build

swag:
	swag init -g cmd/main.go --parseDependency --parseInternal

run: swag
	go run cmd/main.go

build: swag
	go build -o bin/server cmd/main.go