project_name                = "aws-gaming"
environment                 = "default"
aws_region                  = "sa-east-1"
api_lambda_zip_path         = "../../../apps/api/dist/lambda.zip"
shared_health_sidecar_image = "public.ecr.aws/docker/library/busybox@sha256:68fb61caa577f233800d50bef8fe0ee1235ed56a641178783032935223630576"
platform_route53_zone_id    = null

tags = {
  Owner = "platform"
}

game_instances = {
  hello-web = {
    template_id         = "hello-world"
    container_image     = "public.ecr.aws/docker/library/busybox@sha256:68fb61caa577f233800d50bef8fe0ee1235ed56a641178783032935223630576"
    container_command   = ["sh", "-c", "mkdir -p /www && echo ok >/www/index.html && exec httpd -f -p 80 -h /www"]
    game_type           = "generic"
    host_port           = 80
    instance_type       = "t3.micro"
    extra_ingress_cidrs = []
    ssh_ingress_cidrs   = []
    # dns_name             = "hello-web.play.example.com"
  }
}
