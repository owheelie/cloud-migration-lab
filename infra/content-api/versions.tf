terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  backend "s3" {
    key          = "content-api/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
    # bucket and profile come from backend.hcl (not committed)
  }
}

provider "aws" {
  region  = "us-east-2"
  profile = "eml"

  default_tags {
    tags = {
      Project   = "cloud-migration-lab"
      ManagedBy = "terraform"
      Component = "content-api"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name   = "cml-content-api"
  suffix = "${data.aws_caller_identity.current.account_id}-${data.aws_region.current.region}"
}
