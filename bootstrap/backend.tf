terraform {
  backend "s3" {
    key          = "bootstrap/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
    # bucket and profile come from backend.hcl (not committed)
  }
}
