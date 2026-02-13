project_name                = "aws-gaming"
environment                 = "default"
aws_region                  = "sa-east-1"
api_lambda_zip_path         = "../../../apps/api/dist/lambda.zip"
shared_health_sidecar_image = "public.ecr.aws/docker/library/busybox@sha256:68fb61caa577f233800d50bef8fe0ee1235ed56a641178783032935223630576"
platform_route53_zone_id    = "Z076062914KIZVO3HUW39"

tags = {
  Owner = "platform"
}

game_instances = {
  minecraft = {
    template_id     = "minecraft-java"
    container_image = "itzg/minecraft-server:java21"
    container_environment = {
      EULA   = "TRUE"
      TYPE   = "PAPER"
      MEMORY = "2G"
    }
    container_health_check = {
      command      = ["CMD-SHELL", "ps -ef | grep -q '[j]ava'"]
      interval     = 30
      timeout      = 5
      retries      = 5
      start_period = 180
    }
    game_type                    = "minecraft"
    host_port                    = 25565
    query_port                   = 25565
    max_players                  = 20
    instance_type                = "t3.medium"
    container_memory_reservation = 2048
    extra_ingress_cidrs          = []
    ssh_ingress_cidrs            = []
    dns_name                     = "minecraft.aws.hugo.dev.br"
  }

  hello-world = {
    template_id     = "hello-world"
    display_name    = "Hello World"
    game_type       = "generic"
    game_label      = "Hello World"
    location        = "sa-east-1"
    max_players     = 1

    # Use the same image as the health sidecar (BusyBox), but run our own HTTP server
    # on the main service port. The health sidecar still uses :8080.
    container_image = "public.ecr.aws/docker/library/busybox@sha256:68fb61caa577f233800d50bef8fe0ee1235ed56a641178783032935223630576"
    container_command = [
      "sh",
      "-c",
      "mkdir -p /www && echo 'hello-world' >/www/index.html && exec httpd -f -p 80 -h /www",
    ]
    container_environment        = {}
    host_port                   = 80
    instance_type               = "t3.micro"
    container_memory_reservation = 64
    extra_ingress_cidrs         = []
    ssh_ingress_cidrs           = []
  }
}
