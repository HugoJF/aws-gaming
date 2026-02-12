project_name                = "aws-gaming"
environment                 = "default"
aws_region                  = "sa-east-1"
api_lambda_zip_path         = "../../../apps/api/dist/lambda.zip"
shared_health_sidecar_image = null
platform_route53_zone_id    = null

tags = {
  Owner = "platform"
}

game_instances = {
  hello-web = {
    template_id         = "hello-world"
    container_image     = "pvermeyden/nodejs-hello-world:a1e8cf1edcc04e6d905078aed9861807f6da0da4"
    game_type           = "generic"
    host_port           = 80
    instance_type       = "t3.micro"
    extra_ingress_cidrs = []
    ssh_ingress_cidrs   = []
    # dns_name             = "hello-web.play.example.com"
  }
}
