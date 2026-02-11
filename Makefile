SHELL := /usr/bin/env bash

TF_STACK_DIR ?= infra/terraform/stack
TF_BACKEND_FILE ?= backend.hcl
TF_VARS_FILE ?= hello-world.tfvars

.PHONY: help api-lambda tf-fmt tf-init-local tf-validate tf-init tf-plan tf-apply tf-destroy tf-output-api-url

help:
	@echo "Available targets:"
	@echo "  make api-lambda                  Build API Lambda artifact"
	@echo "  make tf-fmt                      Run terraform fmt"
	@echo "  make tf-init-local               Init Terraform with local backend"
	@echo "  make tf-validate                 Init (local backend) + validate"
	@echo "  make tf-init                     Init Terraform with backend config"
	@echo "  make tf-plan                     Terraform plan"
	@echo "  make tf-apply                    Terraform apply"
	@echo "  make tf-destroy                  Terraform destroy"
	@echo "  make tf-output-api-url           Print API Function URL output"
	@echo ""
	@echo "Overrides:"
	@echo "  TF_STACK_DIR=infra/terraform/stack"
	@echo "  TF_BACKEND_FILE=backend.hcl"
	@echo "  TF_VARS_FILE=hello-world.tfvars"

api-lambda:
	bun run build:api:lambda

tf-fmt:
	terraform fmt -recursive infra/terraform

tf-init-local:
	terraform -chdir=$(TF_STACK_DIR) init -backend=false

tf-validate:
	terraform -chdir=$(TF_STACK_DIR) init -backend=false
	terraform -chdir=$(TF_STACK_DIR) validate

tf-init:
	terraform -chdir=$(TF_STACK_DIR) init -backend-config=$(TF_BACKEND_FILE)

tf-plan:
	terraform -chdir=$(TF_STACK_DIR) plan -var-file=$(TF_VARS_FILE)

tf-apply:
	terraform -chdir=$(TF_STACK_DIR) apply -var-file=$(TF_VARS_FILE)

tf-destroy:
	terraform -chdir=$(TF_STACK_DIR) destroy -var-file=$(TF_VARS_FILE)

tf-output-api-url:
	terraform -chdir=$(TF_STACK_DIR) output api_lambda_function_url
