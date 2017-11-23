---
title: This is my title
---
# Examples

[Two Modes](#user-service--in-two-modes) \| [Google Cloud Functions](#to-do-service--on-google-cloud-functions) \| [AWS Lambda](#to-do-service--on-aws-lambda) \| [Back to Home](/../../)

## User service &ndash; in two modes

[A simple user service](https://github.com/modofunjs/modofun/tree/master/examples/user-function-mode) that shows how to build the same application using either [function mode](https://github.com/modofunjs/modofun/tree/master/examples/user-function-mode) or [request/response mode](https://github.com/modofunjs/modofun/tree/master/examples/user-reqres-mode). This example includes middleware to require authentication on certain requests, using JWT tokens. It also uses an Express server to mimic a serverless execution environment locally without having to install an emulator. Try it out:

```bash
git clone https://github.com/modofunjs/modofun.git

cd modofun/examples/user-function-mode
npm install
npm start

curl -d '{"credentials": "X"}' -H "Content-Type: application/json" -X POST http://localhost:3000/authenticate
```

Use `modofun/examples/user-reqres-mode` instead for [the request/response version](https://github.com/modofunjs/modofun/tree/master/examples/user-reqres-mode).

&nbsp;

## To-Do service &ndash; on Google Cloud Functions

[An example To-Do service](https://github.com/modofunjs/modofun/tree/master/examples/todo-google-cloud-functions) that includes scripts to run on Google Cloud Functions, or in the emulator. Install it like this:

```bash
git clone https://github.com/modofunjs/modofun.git

cd modofun/examples/todo-google-cloud-functions
npm install
```

To try it out on Google Cloud, first [follow Google's instructions](https://cloud.google.com/functions/docs/quickstart) to enable the Cloud Functions API, and install the SDK and components.

Create a stage bucket on Cloud Storage. For the script to work without changes, use the bucket name: _modofun-example-src_.

```bash
gsutil mb -p [project-id] gs://modofun-example-src
```

Afterwards, when you're ready to deploy the function, use the deploy script:

```bash
npm run deploy

curl https://us-central1-[project-id].cloudfunctions.net/myModofunExample/addTodo/joe?todo=Do+the+dishes
curl https://us-central1-[project-id].cloudfunctions.net/myModofunExample/getTodos/joe
```

Or try it out using the [local emulator for Google Cloud Functions](https://cloud.google.com/functions/docs/emulator):

```bash
npm run start-emulator
npm run deploy-to-emulator

curl http://localhost:8010/[project-id]/us-central1/myModofunExample/addTodo/joe?todo=Do+the+dishes
curl http://localhost:8010/[project-id]/us-central1/myModofunExample/getTodos/joe

npm run stop-emulator
```

&nbsp;

## To-Do service &ndash; on AWS Lambda

[An example To-Do service](https://github.com/modofunjs/modofun/tree/master/examples/todo-aws-lambda) that includes scripts to deploy it to AWS Lambda using CloudFormation, or run it locally with the AWS Lambda emulator. Install it like this:

```bash
git clone https://github.com/modofunjs/modofun.git

cd modofun/examples/todo-aws-lambda
npm install
```

To try it out on AWS, first [follow AWS's instructions](http://docs.aws.amazon.com/lambda/latest/dg/setup.html) to set up your account and install the AWS CLI (Command Line Interface).

Use the following script to create an S3 bucket to host the code:

```bash
npm run create-s3-bucket
```

When you're ready to deploy the function, use the deploy script, which will package it and deploy it using CloudFormation:

```bash
npm run deploy
```

After the deployment is complete, the script will look up the base URL for the newly deployed API from the AWS CloudFormation Stack. You should see it printed in the console logs when the deployment scripts are finished. It should look like this:

```bash
https://[api-id].execute-api.[region].amazonaws.com/Prod/
```

Then try out the API:

```bash
curl https://[api-id].execute-api.[region].amazonaws.com/Prod/addTodo/joe?todo=Do+the+dishes
curl https://[api-id].execute-api.[region].amazonaws.com/Prod/getTodos/joe
```

You can also try it out using the [local emulator for AWS Lambda](http://docs.aws.amazon.com/lambda/latest/dg/test-sam-local.html):

```bash
npm run start-local

curl http://127.0.0.1:3000/addTodo/joe?todo=Do+the+dishes
curl http://127.0.0.1:3000/getTodos/joe
```

**But note** that there's currently [a bug](https://github.com/awslabs/aws-sam-local/issues/65) in the AWS local emulator that prevents greedy path variables from working properly.

&nbsp;

## Real-world application

There’s also a [real-world example](https://github.com/fptavares/record-scrobbler) that includes:
* [A GraphQL endpoint deployed on Google Cloud Functions](https://github.com/fptavares/record-scrobbler/tree/master/web-api)
* [An AWS Lambda deployment using the default function mode](https://github.com/fptavares/record-scrobbler/tree/master/discogs-service)
* [A Google Cloud Functions deployment using the request/response mode](https://github.com/fptavares/record-scrobbler/tree/master/lastfm-service)

All using modofun, combined with Gulp, Babel and other cool technology.
