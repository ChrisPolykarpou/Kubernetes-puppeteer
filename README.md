# Running Puppeteer crawlers in Kubernetes
Here is an example for running Puppeteer crawlers in a kubernetes Cluster 
I used the following approach for my application -> https://dealer.com.cy

## Sliding-window approach
Running recursively every product one by one to get it's data
is quite slow... I wanted something that would be friendly 
on the store's server (without spamming with lots of requests)
and also on our own resources (less cpu and memory intensive).

So my solution is using a sliding-window where i can concurrently
run a number of crawlers but never exceed the size of the window that
is set. \
    1. Store all links of products \
    2. Use a sliding-window (size N). N tasks spawned for crawling \
        [------]------------- \
    3. Crawl data for all colors and storage by selecting
         all options available. \
    4. Window is full until a process is finished. As soon as 
        there's available space, a new tasks is spawned. \
        -[------]------------   \
        ----[------]---------   

This way i fully utilize my available resources 
and get the job done faster while still respecting 
the client's server. \

## Running it on Kubernetes
Check my Dockerfile to see how i managed to pack up everything needed for puppeteer to run on my nodes \
Sharing one browser for each crawler is crucial so you can get better performance with minimum resources. Check my renderProduct.js file.
 ```
 const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
        ],
        executablePath: '/usr/bin/google-chrome'
    });
 ```

### CronJob
I used kustomize to manage everything together using this kustomization file.
```
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: crawlers

images:
- name: puppeteer
  newName: chpolykarpou/dealercy:crawlers-0.7

resources:
  - resources/namespace.yaml
  - resources/sample-1.yaml
  - resources/sample-2.yaml
  - resources/sample-3.yaml
  - resources/sample-4.yaml
  - resources/dockerSecret.yaml
```
Example for cronJob file below executing every 12 hours
```
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sample-1
spec:
  schedule: "0 */12 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          imagePullSecrets:
          - name: docker-credentials
          containers:
          - name: sample1-crawl
            image: puppeteer
            command: [ "node", "./sample-1/main.js" ]
          restartPolicy: OnFailure
```