"""Architecture diagram for cloud-migration-lab.

Regenerate from the repository root:
    python docs/architecture.py
"""
from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.integration import SQS
from diagrams.aws.management import Cloudwatch
from diagrams.aws.network import APIGateway
from diagrams.aws.storage import S3
from diagrams.onprem.ci import Jenkins
from diagrams.onprem.client import Users
from diagrams.onprem.compute import Server
from diagrams.onprem.iac import Ansible, Terraform
from diagrams.onprem.network import Nginx

try:
    from diagrams.aws.ml import Bedrock
except ImportError:  # older releases of the diagrams library
    from diagrams.aws.ml import Sagemaker as Bedrock

graph_attr = {
    "pad": "0.5",
    "nodesep": "0.8",
    "ranksep": "1.1",
    "fontsize": "22",
    "fontname": "Helvetica",
    "bgcolor": "white",
}

with Diagram(
    "cloud-migration-lab",
    filename="docs/architecture",
    outformat="png",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
):
    visitors = Users("Site visitors")
    editors = Users("Content editors")

    with Cluster("Legacy host (EC2, configured by Ansible)"):
        proxy = Nginx("nginx proxy")
        legacy = Server("Legacy backend")

    with Cluster("AWS serverless  ·  us-east-2"):
        api = APIGateway("HTTP API")
        content_fn = Lambda("Content API\n(TypeScript)")
        content = S3("Content bucket")

        landing = S3("Landing bucket")
        queue = SQS("Ingest queue")
        dlq = SQS("Dead-letter queue")
        ingest_fn = Lambda("Ingest worker\n(TypeScript)")
        bedrock = Bedrock("Bedrock\n(document tagging)")
        alarms = Cloudwatch("Logs & alarms")

    with Cluster("Delivery (Terraform provisions all AWS resources)"):
        ansible = Ansible("Ansible")
        jenkins = Jenkins("Jenkins")
        terraform = Terraform("Terraform")
        state = S3("State bucket")

    visitors >> proxy
    proxy >> Edge(label="routes not yet migrated", style="dashed") >> legacy
    proxy >> Edge(label="migrated routes") >> api >> content_fn >> content

    editors >> landing >> Edge(label="object created") >> queue >> ingest_fn
    queue >> Edge(label="after retries", style="dashed", color="firebrick") >> dlq
    ingest_fn >> content
    ingest_fn >> bedrock
    dlq >> alarms

    ansible >> Edge(label="configures") >> jenkins
    jenkins >> Edge(label="plan / approve / apply") >> terraform >> state
