const cheerio = require('cheerio');
const db = require('../util/db');

const connection = db.pool;
// get promises instead of using callbacks
const util = require('util')
const queryCallback = connection.query.bind(connection)
const queryPromise = util.promisify(queryCallback) // now this returns a promise we can "await"
const sql = "INSERT INTO plans (prodID, sku, title, planTitle, upfrontCost, perMonthCost, perMonthOffer, offerTip, contractLength, data, minutes, messages, link, shopID, availability, bit) VALUES ? ON DUPLICATE KEY UPDATE upfrontCost = VALUES(upfrontCost), perMonthCost = VALUES(perMonthCost), perMonthOffer = VALUES(perMonthOffer), offerTip = VALUES(offerTip), bit = VALUES(bit), availability = VALUES(availability), link = VALUES(link), data = VALUES(data), minutes = VALUES(minutes), messages = VALUES(messages)";
var crypto = require('crypto');
const { off } = require('process');

async function ssr(browser, url, selector, colorLinks, memLinks) {

  let data;

  const page = await browser.newPage();

  // set user-agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9'
  )

  try {
    // networkidle0 waits for the network to be idle (no requests for 500ms).
    // The page's JS has likely produced markup by this point, but wait longer
    // if site lazy loads, etc.
    await page.goto(url, {waitUntil: 'networkidle0'});

    // Crawl options
    for(var col=0; col < colorLinks.length; col++){
        // Click memory options to crawl
        await Promise.all([
            (await page.evaluate(colorLinks[col], () => colorLinks[col])),
            await page.waitForSelector(selector, {timeout: 35000})
        ])
        for(var mem=0; mem < memLinks.length; mem++){
            await Promise.all([
                (await page.evaluate(memLinks[mem], () => memLinks[mem])),
                await page.waitForSelector(selector, {timeout: 35000})
            ])
            // store content
            data = await page.content();
            // pass each new option for processing
            await processData(data, url); 
        }
    }
        
  } catch (err) {
        // Timeout error is OK. 
        // Means button does not exists or all products are fetched
        console.log(err);
        await console.log("Rendered url: "+url);
        await page.close();
        return data;
    }
    await page.close();
}

// This function uses cheerio to process our html and import into DB
async function processData(html, link){
    var $ = cheerio.load(html);

    var selectedColor = $('.FilterSelectedColour a').attr('title');
    var selectedStorage = $('.FilterSelectedMemory a').attr('title');
    
    var title = $("[itemprop='name']").text().trim();
    title = title.replace(/^(.*?)(?:\s+\1)+$/, '$1').trim();
    var sku = link.substring(link.indexOf('productsn=')+10, link.indexOf('&'));
    var offerTip = $('.devices-gift.bg-orange a').text().trim()

    if(selectedColor !== undefined){
        title = title + " " + selectedStorage + " " + selectedColor;
        sku = link.substring(link.indexOf('productsn=')+10, link.indexOf('&')) + selectedColor + selectedStorage;
        sku = (crypto.createHash('md5').update(sku).digest('hex')).substring(0, 20);
    }

    if(title === undefined)
        return
    var availability = $(".InStock")
    if(availability.length>0)
        availability = 'Y';
    else
        availability = 'N';
    
    var retailPrice = $("#cphContent_ucp_lblRetailPrice").text()
    retailPrice = retailPrice.replace(',','.');
    retailPrice = retailPrice.substring(retailPrice.indexOf('€')+1)

    // Store plan info
    var planCount = $('.planbox');
    
    var planTitle=[], upfrontCost=[], perMonthCost=[], perMonthOffer=[], data=[], minutes=[], messages=[], links=[];
    for(var i=0; i<planCount.length-1; i++){
        planTitle.push($(planCount[i]).find('h2').text().trim());
        upfrontCost.push($(planCount[i]).find('.col-lg-auto.my-2 .priceLabels.pt-2').text().trim());
        upfrontCost[i] = upfrontCost[i].substring(0, upfrontCost[i].indexOf('\n'));
        upfrontCost[i] = (upfrontCost[i].substring(1));
        upfrontCost[i] = upfrontCost[i].replace(',','.');
        perMonthCost.push($(planCount[i]).find('.col-lg-3.my-2 .priceLabels.pt-2 span').text().trim());
        
        perMonthCost[i] = (perMonthCost[i].substring(1))
        perMonthCost[i] = perMonthCost[i].replace(',','.');
        perMonthOffer.push($(planCount[i]).find('.plan-offer').text().trim())
        // Offer is for 24 months
        var offerTiptemp=""
        if(perMonthOffer[i].includes("20%") || perMonthOffer[i].includes("Προσφορά") || perMonthOffer[i].includes("Offer")){
            perMonthCost[i]=perMonthCost[i]-perMonthCost[i]*0.2
            perMonthOffer[i]=0
            offerTiptemp = "20% monthly discount!"
        }
        else
            perMonthOffer[i]=0

        if(offerTip.includes("insurance")){
            if(planTitle[i].includes("FREEDOM")){
                if(offerTiptemp.length>1)
                    var offerTiptemp = offerTiptemp+". Free insurance for 1 year"
                else
                    var offerTiptemp = "Free insurance for 1 year"
            }
        }

        data.push($(planCount[i]).find('.float-left a b').text().trim());
        if(data[i] == '')
            data[i] = $(planCount[i]).find('li:nth-child(2)').text().trim();
        
        if(data[i].includes('Απεριόριστα'))
            data[i] = 'Unlimited';
        minutes.push($(planCount[i]).find('li:nth-child(1)').text().trim());
        minutes[i] = minutes[i].substring(0, minutes[i].indexOf('\n'));
        if(minutes[i].includes('Απεριόριστα'))
            minutes[i] = 'Unlimited';
        messages.push(minutes[i]);

        // Select plan through Link
        links.push(link.replace("psn=&hsn=&pt=0&plan=", planLinks[planTitle[i]]))
        
        // insert into DB
        await queryPromise(sql, [[[-1, sku+i, title, planTitle[i], upfrontCost[i], perMonthCost[i], perMonthOffer[i], offerTiptemp, '24 Months', data[i], minutes[i], messages[i], links[i], 14, availability, 1]]]);
    }
    console.log(title)
}

module.exports = { ssr };