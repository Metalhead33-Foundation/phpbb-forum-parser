const cheerio = require('cheerio');
const got = require('got');
const fs = require('fs');

if(!fs.existsSync("output")) {
    fs.mkdirSync("output")
}

async function fetchIndex(target) {
    console.log("Loading index at: " + target)

    if(fs.existsSync("output/"+target.substring(1)+".idx")) {
        console.log("Already loaded");
        links = fs.readFileSync("output/"+target.substring(1)+".idx",{encoding: 'utf8', flag: 'r'}).split('\n')

        for(let link of links) {
            switch(link[1]) {
                case 't':
                    await fetchTopic(link);
                    break;
                case 'f':
                    await fetchIndex(link);
                    break;
            }
        }

        return
    }

    const {body} = await got.get("https://wod-game.hungarianforum.com"+target);
    const $ = cheerio.load(body);

    const asub = $(".hierarchy a.forumlink").toArray()
    const atopic = $("div.topictitle  a" ).toArray()

    fs.writeFileSync("output/"+target.substring(1)+".idx",asub.concat(atopic).map((elem) => $(elem).attr('href')).join("\n"));

    for( let a of asub ) {
        await fetchIndex($(a).attr('href'))
    }

    for( let a of atopic) {
        await fetchTopic($(a).attr('href'))
    }
}

async function fetchTopic(destination) {
    console.log("Loading post at: " + destination);
    if(fs.existsSync("output/"+destination.substring(1)+".txt")) {
        console.log("Duplicate");
        return
    }

    const {body} = await got.get("http://wod-game.hungarianforum.com"+destination);
    const $ = cheerio.load(body);
    let result = [];

    $(".forumline > tbody > tr.post").each((idx,elem) => {
        result.push({
            name: $(elem).find("span.name").text().trim(),
            content: $(elem).find("div.postbody > div").html().trim(),
            date: $(elem).find("table > tbody > tr > td > span.postdetails").contents().filter(function(){return this.nodeType === 3}).last().text().trim(),
        })
    });
    let processedResult = [];
    for (var i = 0; i < result.length; i++) {
        const processedIndex = processedResult.length - 1;
        if(i == 0) {
            processedResult.push(result[i]);
        } else if(processedResult[processedIndex].name === result[i].name) {
            processedResult[processedIndex].content = processedResult[processedIndex].content + '<br>\n' + result[i].content;
        } else {
            processedResult.push(result[i]);
        }
    }

    fs.writeFile("output/"+destination.substring(1)+".txt", processedResult.map(({name,content,date}) => {
            return (
                `{{RPG Post/${name}
|date=${date}
|hun=yes
|post=${content.replace(/\*/,"{{Str}}")}
}}`
                )
            }).join("\n"),() => {}
    );

    for(let a of $("table.noprint td.row1 a img.sprite-arrow_subsilver_right").parent().toArray()) {
        await fetchTopic($(a).attr("href"));
    }
};

fetchIndex("/").then(() => console.log("finished"));
