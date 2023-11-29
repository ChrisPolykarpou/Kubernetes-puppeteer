const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const utilFunction = require('./enquePages');
const productRender = require('./renderProduct');
const db = require('../util/db');

const maxConcurrent = 3;    // Keeping it low, I only have 2 nodes(2vcpu, 4GB ram) to run.
const maxExecutionTimeMs = 10 * 60 * 1000;
var links = [];

enqLinks(url);

// Get links to crawl
async function enqLinks(url){    
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
        ],
        executablePath: '/usr/bin/google-chrome'
    });

    const html = await utilFunction.ssr(browser, url, '.device.col-12', 1);
    var $ = cheerio.load(html)

    var numOfElems = $('.device.col-12').length;
    console.log("Products to crawl: "+numOfElems);
    
    // Get all links available to crawl
    var links = [];
    $('.device.col-12').each(async function(){
        var link = $(this).attr('href');
        links.push(link);
    });
   
    // Recursive function for sliding-window (concurrent crawling)
    let tasks=0
    async function processLinks(link){
        while(tasks >= maxConcurrent){
            await sleep(2000);
        }
        tasks++
        await crawl(browser, link);
        tasks--;
        
    }
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    for(let i=0; i < links.length; i++){
        processLinks(links[i])
    }
    
}

async function crawl(browser, link){
    const insideContent = await axios.get(link);
    // find options and colours links to pass them on puppeteer.. 
    var $ = cheerio.load(insideContent.data);
    var numOfColors = $('#pnlColor a').length;
    var numOfMem = $('#pnlMemory a').length;
    
    // Array to store memory and color options for __dopostBack func
    var colorLinks = [];
    var memLinks = [];

    for(var i=0; i < numOfColors; i++){
        colorLinks[i] = ($('#pnlColor:nth-child('+(i+2)+') a').attr('href'));
    }
    for(var i=0; i < numOfMem; i++){
        memLinks[i] = $('#pnlMemory:nth-of-type('+(i+1+numOfColors)+') a').attr('href');
    }

    // Pass link with colors and storage to ssr function for rendering
    await productRender.ssr(browser, link, '.col-lg-4', colorLinks, memLinks);
}

// Create a timeout to force script termination after the specified duration
const timeout = setTimeout(() => {
  console.log('Execution time limit (20 minutes) reached. Terminating script.');
  process.exit(0); // Exit the script gracefully
}, maxExecutionTimeMs);