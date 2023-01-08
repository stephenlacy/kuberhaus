FROM golang:1.19 as build_image
ADD ./main.go ./go.mod ./go.sum /app/
WORKDIR /app
RUN GOOS=linux GOARCH=386 CGO_ENABLED=0 go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
RUN mkdir /app
WORKDIR /app
COPY --from=build_image /app/main .
ADD ./dashboard/dist/* /app/static/
EXPOSE 8282
CMD ["./main"]
