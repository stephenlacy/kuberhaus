FROM golang:latest
LABEL maintainer="Giovanny Reyes O <giovannyreyeso@gmail.com>"
WORKDIR /app
COPY go.mod go.sum main.go ./
RUN go build -o main .
EXPOSE 8282
CMD ["./main"]