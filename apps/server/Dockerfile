FROM golang:1.25-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum* ./
RUN go mod download

COPY . .
RUN go build -o main ./cmd/api

CMD ["./main"]