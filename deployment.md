# Quartermaster - Deployment

You can deploy the project using Docker Compose to a remote server.

This project expects you to have a Traefik proxy handling communication to the outside world and HTTPS certificates.

CI/CD via GitHub Actions is planned but not yet configured. The section below describes the intended setup.

You have to configure a couple things first.

## Preparation

* Have a remote server ready and available.
* Configure the DNS records of your domain to point to the IP of the server you just created.
* Configure a wildcard subdomain for your domain, so that you can have multiple subdomains for different services, e.g. `*.book.star-fleet.tours`. This is used for accessing different components: `admin.book.star-fleet.tours` (admin dashboard), `api.book.star-fleet.tours` (backend API), `traefik.book.star-fleet.tours`, `adminer.book.star-fleet.tours`, etc. And also for staging: `admin.staging.book.star-fleet.tours`, `api.staging.book.star-fleet.tours`, etc.
* Install and configure [Docker](https://docs.docker.com/engine/install/) on the remote server (Docker Engine, not Docker Desktop).

## Public Traefik

We need a Traefik proxy to handle incoming connections and HTTPS certificates.

You need to do these next steps only once.

### Traefik Docker Compose

* Create a remote directory to store your Traefik Docker Compose file:

```bash
mkdir -p /root/code/traefik-public/
```

Copy the Traefik Docker Compose file to your server. You could do it by running the command `rsync` in your local terminal:

```bash
rsync -a docker-compose.traefik.yml root@your-server.example.com:/root/code/traefik-public/
```

### Traefik Public Network

This Traefik will expect a Docker "public network" named `traefik-public` to communicate with your stack(s).

This way, there will be a single public Traefik proxy that handles the communication (HTTP and HTTPS) with the outside world, and then behind that, you could have one or more stacks with different domains, even if they are on the same single server.

To create a Docker "public network" named `traefik-public` run the following command in your remote server:

```bash
docker network create traefik-public
```

### Traefik Environment Variables

The Traefik Docker Compose file expects some environment variables to be set in your terminal before starting it. You can do it by running the following commands in your remote server.

* Create the username for HTTP Basic Auth, e.g.:

```bash
export USERNAME=admin
```

* Create an environment variable with the password for HTTP Basic Auth, e.g.:

```bash
export PASSWORD=changethis
```

* Use openssl to generate the "hashed" version of the password for HTTP Basic Auth and store it in an environment variable:

```bash
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
```

To verify that the hashed password is correct, you can print it:

```bash
echo $HASHED_PASSWORD
```

* Create an environment variable with the domain name for your server, e.g.:

```bash
export DOMAIN=book.star-fleet.tours
```

* Create an environment variable with the email for Let's Encrypt, e.g.:

```bash
export EMAIL=admin@example.com
```

**Note**: you need to set a different email, an email `@example.com` won't work.

### Start the Traefik Docker Compose

Go to the directory where you copied the Traefik Docker Compose file in your remote server:

```bash
cd /root/code/traefik-public/
```

Now with the environment variables set and the `docker-compose.traefik.yml` in place, you can start the Traefik Docker Compose running the following command:

```bash
docker compose -f docker-compose.traefik.yml up -d
```

## Deploy Quartermaster

Now that you have Traefik in place you can deploy Quartermaster with Docker Compose.

**Note**: You might want to jump ahead to the section about Continuous Deployment with GitHub Actions.

### Subdomain routing

The production `docker-compose.yml` configures Traefik to route the frontend to two domains:

* **`${DOMAIN}`** (e.g. `book.star-fleet.tours`) -- public booking form
* **`admin.${DOMAIN}`** (e.g. `admin.book.star-fleet.tours`) -- admin dashboard

The backend API is served at **`api.${DOMAIN}`**. Both domains serve the same frontend container; client-side routing determines which UI is shown.

Make sure your DNS has wildcard records (`*.book.star-fleet.tours`) or individual A/CNAME records for each subdomain (`admin.`, `api.`, `adminer.`, `traefik.`, and their staging equivalents).

### Stripe webhook

In production, configure a Stripe webhook endpoint pointing to:

```
https://api.book.star-fleet.tours/api/v1/bookings/stripe-webhook
```

Set the signing secret as `STRIPE_WEBHOOK_SECRET` in your environment.

## Environment Variables

You need to set some environment variables first.

Set the `ENVIRONMENT`, by default `local` (for development), but when deploying to a server you would put something like `staging` or `production`:

```bash
export ENVIRONMENT=production
```

Set the `DOMAIN`, by default `localhost` (for development), but when deploying you would use your own domain:

```bash
export DOMAIN=book.star-fleet.tours
```

You can set several variables, like:

* `PROJECT_NAME`: The name of the project, used in the API docs and emails (default: `Quartermaster API`).
* `STACK_NAME`: The name of the stack used for Docker Compose labels and project name (default: `quartermaster-api`). This should be different for `staging` and `production`, e.g. `quartermaster-api` and `staging-quartermaster-api`.
* `BACKEND_CORS_ORIGINS`: **Additional** CORS origins (comma-separated). The backend always allows `FRONTEND_HOST`; set this only when you need **extra** origins (e.g. a second frontend, staging when the same API serves both prod and staging, or another domain). Format: full URLs including scheme, e.g. `https://dashboard.staging.book.star-fleet.tours`. Leave empty or unset if you have a single frontend at `FRONTEND_HOST`.
* `SECRET_KEY`: The secret key for the FastAPI project, used to sign tokens.
* `FIRST_SUPERUSER`: The email of the first superuser, this superuser will be the one that can create new users.
* `FIRST_SUPERUSER_PASSWORD`: The password of the first superuser.
* `SMTP_HOST`: The SMTP server host to send emails, this would come from your email provider (E.g. Mailgun, Sparkpost, Sendgrid, etc).
* `SMTP_USER`: The SMTP server user to send emails.
* `SMTP_PASSWORD`: The SMTP server password to send emails.
* `EMAILS_FROM_EMAIL`: The email account to send emails from.
* `POSTGRES_SERVER`: The hostname of the PostgreSQL server. You can leave the default of `db`, provided by the same Docker Compose. You normally wouldn't need to change this unless you are using a third-party provider.
* `POSTGRES_PORT`: The port of the PostgreSQL server. You can leave the default. You normally wouldn't need to change this unless you are using a third-party provider.
* `POSTGRES_PASSWORD`: The Postgres password.
* `POSTGRES_USER`: The Postgres user, you can leave the default.
* `POSTGRES_DB`: The database name to use for this application (default: `quartermaster_api`).
* `SENTRY_DSN`: The DSN for Sentry, if you are using it.
* `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (live mode for production).
* `STRIPE_SECRET_KEY`: Stripe secret key (live mode for production).
* `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret.
* `QR_CODE_BASE_URL`: Base URL encoded in QR code tickets for check-in (e.g. `https://admin.book.star-fleet.tours`). Defaults to `FRONTEND_HOST` if unset.

## GitHub Actions Environment Variables

There are some environment variables only used by GitHub Actions that you can configure:

* `LATEST_CHANGES`: Used by the GitHub Action [latest-changes](https://github.com/tiangolo/latest-changes) to automatically add release notes based on the PRs merged. It's a personal access token, read the docs for details.
* `SMOKESHOW_AUTH_KEY`: Used to handle and publish the code coverage using [Smokeshow](https://github.com/samuelcolvin/smokeshow), follow their instructions to create a (free) Smokeshow key.

### Generate secret keys

Some environment variables in the `.env` file have a default value of `changethis`.

You have to change them with a secret key, to generate secret keys you can run the following command:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the content and use that as password / secret key. And run that again to generate another secure key.

### Deploy with Docker Compose

With the environment variables in place, you can deploy with Docker Compose:

```bash
docker compose -f docker-compose.yml up -d
```

For production you wouldn't want to have the overrides in `docker-compose.override.yml`, that's why we explicitly specify `docker-compose.yml` as the file to use.

## Continuous Deployment (CD) (planned)

> **Note:** GitHub Actions workflows have not been created yet. The following describes the intended setup for when CI/CD is implemented.

### Install GitHub Actions Runner

* On your remote server, create a user for your GitHub Actions:

```bash
sudo adduser github
```

* Add Docker permissions to the `github` user:

```bash
sudo usermod -aG docker github
```

* Temporarily switch to the `github` user:

```bash
sudo su - github
```

* Go to the `github` user's home directory:

```bash
cd
```

* [Install a GitHub Action self-hosted runner following the official guide](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners#adding-a-self-hosted-runner-to-a-repository).

* When asked about labels, add a label for the environment, e.g. `production`. You can also add labels later.

After installing, the guide would tell you to run a command to start the runner. Nevertheless, it would stop once you terminate that process or if your local connection to your server is lost.

To make sure it runs on startup and continues running, you can install it as a service. To do that, exit the `github` user and go back to the `root` user:

```bash
exit
```

After you do it, you will be on the previous user again. And you will be on the previous directory, belonging to that user.

Before being able to go the `github` user directory, you need to become the `root` user (you might already be):

```bash
sudo su
```

* As the `root` user, go to the `actions-runner` directory inside of the `github` user's home directory:

```bash
cd /home/github/actions-runner
```

* Install the self-hosted runner as a service with the user `github`:

```bash
./svc.sh install github
```

* Start the service:

```bash
./svc.sh start
```

* Check the status of the service:

```bash
./svc.sh status
```

You can read more about it in the official guide: [Configuring the self-hosted runner application as a service](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service).

### Set Secrets

On your repository, configure secrets for the environment variables you need, the same ones described above, including `SECRET_KEY`, etc. Follow the [official GitHub guide for setting repository secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository).

The current Github Actions workflows expect these secrets:

* `DOMAIN_PRODUCTION`
* `DOMAIN_STAGING`
* `STACK_NAME_PRODUCTION`
* `STACK_NAME_STAGING`
* `EMAILS_FROM_EMAIL`
* `FIRST_SUPERUSER`
* `FIRST_SUPERUSER_PASSWORD`
* `POSTGRES_PASSWORD`
* `SECRET_KEY`
* `STRIPE_PUBLISHABLE_KEY`
* `STRIPE_SECRET_KEY`
* `STRIPE_WEBHOOK_SECRET`
* `LATEST_CHANGES`
* `SMOKESHOW_AUTH_KEY`

## GitHub Action Deployment Workflows (planned)

When implemented, the intended workflow triggers are:

* `staging`: after pushing (or merging) to the branch `master`.
* `production`: after publishing a release.

## URLs

### Traefik Dashboard

Traefik UI: `https://traefik.book.star-fleet.tours`

### Production

| Service | URL |
|---|---|
| Public booking | `https://book.star-fleet.tours` |
| Admin dashboard | `https://admin.book.star-fleet.tours` |
| Backend API | `https://api.book.star-fleet.tours` |
| API documentation (Swagger) | `https://api.book.star-fleet.tours/docs` |
| API documentation (ReDoc) | `https://api.book.star-fleet.tours/redoc` |
| Adminer | `https://adminer.book.star-fleet.tours` |

### Staging

| Service | URL |
|---|---|
| Public booking | `https://staging.book.star-fleet.tours` |
| Admin dashboard | `https://admin.staging.book.star-fleet.tours` |
| Backend API | `https://api.staging.book.star-fleet.tours` |
| API documentation (Swagger) | `https://api.staging.book.star-fleet.tours/docs` |
| API documentation (ReDoc) | `https://api.staging.book.star-fleet.tours/redoc` |
| Adminer | `https://adminer.staging.book.star-fleet.tours` |
