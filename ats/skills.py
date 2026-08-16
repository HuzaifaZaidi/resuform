"""Expandable skill and alias catalog for the Resuform ATS scorer."""

from __future__ import annotations

# label|category|alias1|alias2|...
# Categories: language, framework, database, cloud, tool, ml, cert, domain, soft
_CATALOG = """
Python|language|python|python3|python 3
Java|language|java
JavaScript|language|javascript|js|ecmascript
TypeScript|language|typescript|ts
C++|language|c++|cpp|cplusplus|c plus plus
C#|language|c#|csharp|c sharp
C|language|c language
Go|language|golang|go lang
Rust|language|rust
Ruby|language|ruby
PHP|language|php
Swift|language|swift
Kotlin|language|kotlin
Scala|language|scala
R|language|r language|r programming
MATLAB|language|matlab
SQL|language|sql|structured query language
HTML|language|html|html5
CSS|language|css|css3
Bash|language|bash|shell scripting|shell script
PowerShell|language|powershell
Dart|language|dart
Perl|language|perl
Lua|language|lua
Objective-C|language|objective-c|objective c
Haskell|language|haskell
Elixir|language|elixir
Clojure|language|clojure
Groovy|language|groovy
Visual Basic|language|vb.net|visual basic|vba
Assembly|language|assembly|asm
React|framework|react|react.js|reactjs
React Native|framework|react native|react-native
Next.js|framework|next.js|nextjs|next js
Angular|framework|angular|angular.js|angularjs
Vue|framework|vue|vue.js|vuejs
Svelte|framework|svelte|sveltekit
Node.js|framework|node.js|nodejs|node
Express|framework|express|express.js|expressjs
Django|framework|django
Flask|framework|flask
FastAPI|framework|fastapi|fast api
Spring|framework|spring|spring boot|springboot
Laravel|framework|laravel
Rails|framework|rails|ruby on rails|ror
ASP.NET|framework|asp.net|aspnet|asp .net|.net core|dotnet|dot net
jQuery|framework|jquery
Redux|framework|redux
GraphQL|framework|graphql|graph ql
gRPC|framework|grpc|g rpc
REST|framework|rest|rest api|restful
SOAP|framework|soap
Flutter|framework|flutter
Android|framework|android
iOS|framework|ios
Electron|framework|electron
NestJS|framework|nestjs|nest.js
Nuxt|framework|nuxt|nuxt.js|nuxtjs
SvelteKit|framework|sveltekit
Tailwind CSS|framework|tailwind|tailwindcss|tailwind css
Bootstrap|framework|bootstrap
Material UI|framework|material ui|mui|material-ui
Pandas|framework|pandas
NumPy|framework|numpy|np
SciPy|framework|scipy
scikit-learn|ml|scikit-learn|sklearn|scikit learn
PyTorch|ml|pytorch|torch
TensorFlow|ml|tensorflow|tf
Keras|ml|keras
OpenCV|ml|opencv|cv2
Hugging Face|ml|hugging face|huggingface|transformers
NLTK|ml|nltk
spaCy|ml|spacy
XGBoost|ml|xgboost|xgb
LightGBM|ml|lightgbm
Machine Learning|ml|machine learning|ml
Deep Learning|ml|deep learning|dl
Natural Language Processing|ml|nlp|natural language processing
Computer Vision|ml|computer vision|cv
Data Science|ml|data science|data scientist
LLM|ml|large language model|llms|generative ai|genai
Prompt Engineering|ml|prompt engineering
LangChain|ml|langchain
RAG|ml|retrieval augmented generation|rag
PostgreSQL|database|postgresql|postgres|pgsql|psql
MySQL|database|mysql
SQLite|database|sqlite
MongoDB|database|mongodb|mongo
Redis|database|redis
Oracle|database|oracle|oracle db
SQL Server|database|sql server|mssql|microsoft sql server
MariaDB|database|mariadb
Cassandra|database|cassandra
DynamoDB|database|dynamodb|dynamo db
Elasticsearch|database|elasticsearch|elastic search|elk
Snowflake|database|snowflake
BigQuery|database|bigquery|big query
Redshift|database|redshift
Hive|database|hive
HBase|database|hbase
Neo4j|database|neo4j|neo4 j
Firebase|database|firebase
Supabase|database|supabase
Prisma|database|prisma
Sequelize|database|sequelize
SQLAlchemy|database|sqlalchemy
Hadoop|database|hadoop
Spark|database|spark|apache spark|pyspark
Kafka|tool|kafka|apache kafka
RabbitMQ|tool|rabbitmq|rabbit mq
Airflow|tool|airflow|apache airflow
dbt|tool|dbt|data build tool
Tableau|tool|tableau
Power BI|tool|power bi|powerbi
Looker|tool|looker
Excel|tool|excel|microsoft excel
Jira|tool|jira
Confluence|tool|confluence
Git|tool|git
GitHub|tool|github|git hub
GitLab|tool|gitlab
Bitbucket|tool|bitbucket
Docker|tool|docker
Kubernetes|tool|kubernetes|k8s
Terraform|tool|terraform
Ansible|tool|ansible
Jenkins|tool|jenkins
CircleCI|tool|circleci|circle ci
GitHub Actions|tool|github actions|github action
Linux|tool|linux|unix
Nginx|tool|nginx
Apache|tool|apache httpd|apache
Webpack|tool|webpack
Vite|tool|vite
Babel|tool|babel
ESLint|tool|eslint
Prettier|tool|prettier
Jest|tool|jest
Cypress|tool|cypress
Playwright|tool|playwright
Selenium|tool|selenium
Postman|tool|postman
Swagger|tool|swagger|openapi
Figma|tool|figma
Photoshop|tool|photoshop
Illustrator|tool|illustrator
Blender|tool|blender
Unity|tool|unity
Unreal Engine|tool|unreal|unreal engine
LaTeX|tool|latex|tex
VS Code|tool|vscode|vs code|visual studio code
Visual Studio|tool|visual studio
IntelliJ|tool|intellij|intelli j
PyCharm|tool|pycharm
Maven|tool|maven
Gradle|tool|gradle
npm|tool|npm
yarn|tool|yarn
pnpm|tool|pnpm
Make|tool|makefile|gnu make
CMake|tool|cmake
Prometheus|tool|prometheus
Grafana|tool|grafana
Datadog|tool|datadog
Sentry|tool|sentry
New Relic|tool|new relic
Splunk|tool|splunk
ELK|tool|elk stack|elasticsearch logstash kibana
Logstash|tool|logstash
Kibana|tool|kibana
Helm|tool|helm
Istio|tool|istio
Argo CD|tool|argo cd|argocd
Pulumi|tool|pulumi
Vagrant|tool|vagrant
VirtualBox|tool|virtualbox
VMware|tool|vmware
AWS|cloud|aws|amazon web services
Azure|cloud|azure|microsoft azure
GCP|cloud|gcp|google cloud|google cloud platform
Heroku|cloud|heroku
Netlify|cloud|netlify
Vercel|cloud|vercel
DigitalOcean|cloud|digitalocean|digital ocean
Cloudflare|cloud|cloudflare
S3|cloud|s3|amazon s3|aws s3
EC2|cloud|ec2|amazon ec2
Lambda|cloud|lambda|aws lambda
RDS|cloud|rds|amazon rds
EKS|cloud|eks|amazon eks
ECS|cloud|ecs|amazon ecs
CloudFormation|cloud|cloudformation
IAM|cloud|iam|identity and access management
SageMaker|cloud|sagemaker|amazon sagemaker
Vertex AI|cloud|vertex ai
OpenStack|cloud|openstack
AWS Certified Solutions Architect|cert|aws certified solutions architect|aws solutions architect
AWS Certified Developer|cert|aws certified developer
Azure Administrator|cert|az-104|azure administrator
GCP Associate Cloud Engineer|cert|gcp associate cloud engineer
Certified Kubernetes Administrator|cert|cka|certified kubernetes administrator
Terraform Associate|cert|terraform associate
PMP|cert|pmp|project management professional
Scrum Master|cert|csm|certified scrum master|scrum master
ITIL|cert|itil
CompTIA Security+|cert|security+|comptia security+
CISSP|cert|cissp
CEH|cert|ceh|certified ethical hacker
Cisco CCNA|cert|ccna
Oracle Certified|cert|oca|ocp|oracle certified
Google Data Analytics|cert|google data analytics
TensorFlow Developer|cert|tensorflow developer certificate
System Design|domain|system design|distributed systems
Microservices|domain|microservices|micro services
CI/CD|domain|ci/cd|cicd|continuous integration|continuous delivery
DevOps|domain|devops|dev ops
SRE|domain|sre|site reliability
Agile|domain|agile|scrum|kanban
Test Driven Development|domain|tdd|test driven development
Object Oriented Programming|domain|oop|object oriented
Data Structures|domain|data structures|dsa|algorithms
Networking|domain|networking|computer networks|tcp/ip
Cybersecurity|domain|cybersecurity|information security|infosec
Authentication|domain|oauth|oauth2|jwt|sso|saml
API Design|domain|api design|api development
ETL|domain|etl|elt|data pipeline
Data Warehousing|domain|data warehouse|data warehousing
Business Intelligence|domain|business intelligence|bi
Product Management|domain|product management
UI/UX|domain|ui/ux|user experience|user interface|ux
Frontend|domain|frontend|front-end|front end
Backend|domain|backend|back-end|back end
Full Stack|domain|full stack|fullstack|full-stack
Mobile Development|domain|mobile development|android development|ios development
QA|domain|qa|quality assurance|software testing
Communication|soft|communication|written communication
Leadership|soft|leadership|team leadership
Collaboration|soft|collaboration|teamwork|team work
Problem Solving|soft|problem solving|analytical skills
"""

TITLE_ALIASES = {
    "software engineer": ["software engineer", "swe", "sde", "software developer", "application developer"],
    "backend engineer": ["backend engineer", "back-end engineer", "backend developer", "server engineer"],
    "frontend engineer": ["frontend engineer", "front-end engineer", "frontend developer", "ui engineer"],
    "full stack engineer": ["full stack", "fullstack", "full-stack engineer", "full stack developer"],
    "data scientist": ["data scientist", "applied scientist"],
    "data engineer": ["data engineer", "analytics engineer"],
    "machine learning engineer": ["machine learning engineer", "ml engineer", "mle", "ai engineer"],
    "devops engineer": ["devops engineer", "dev ops", "platform engineer", "sre", "site reliability"],
    "product manager": ["product manager", "pm", "product owner"],
    "qa engineer": ["qa engineer", "sdet", "test engineer", "quality engineer"],
    "mobile engineer": ["mobile engineer", "android developer", "ios developer", "mobile developer"],
    "security engineer": ["security engineer", "application security", "appsec"],
    "engineering manager": ["engineering manager", "em", "dev manager"],
    "intern": ["intern", "internship", "co-op", "coop"],
}


def _parse_catalog() -> list[dict]:
    items = []
    seen = set()
    for raw in _CATALOG.strip().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) < 3:
            continue
        label, category, *aliases = parts
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        alias_list = []
        for alias in aliases:
            a = alias.strip().lower()
            if a and a not in alias_list:
                alias_list.append(a)
        if label.lower() not in alias_list:
            alias_list.insert(0, label.lower())
        items.append({"label": label, "canonical": key, "category": category, "aliases": alias_list})
    return items


SKILLS = _parse_catalog()
SKILL_BY_ALIAS: dict[str, dict] = {}
for skill in SKILLS:
    for alias in skill["aliases"]:
        SKILL_BY_ALIAS.setdefault(alias, skill)

TECH_CATEGORIES = {"language", "framework", "database", "cloud", "tool", "ml", "cert"}
