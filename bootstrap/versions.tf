terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = "us-east-2"
  profile = "eml"

  default_tags {
    tags = {
      Project   = "cloud-migration-lab"
      ManagedBy = "terraform"
      Component = "bootstrap"
    }
  }
}
