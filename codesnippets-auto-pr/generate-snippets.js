const https = require('https');
const fs = require('fs');
const yaml = require('js-yaml');
const PRIMARY_BRANCH_NAME = 'master';

async function getJsonFromCodeSnippet(snippet_config_url, language, keys_to_replace_client, keys_to_replace_code){
    return new Promise(resolve=>{
        keys_to_replace_code = keys_to_replace_code.concat(keys_to_replace_client)
        const file = fs.createWriteStream('./out/code-snippet.yaml', {flags: 'w'})    
        const request = https.get(snippet_config_url, function(response){
        response.pipe(file);
        file.on('finish', async function(){
            file.close();
            let fileContents = fs.readFileSync('./out/code-snippet.yaml');
            // console.log(`processing ${snippet_config_url}`);            
            let data = yaml.load(fileContents);
            if(!data.language){
                data.language=language;                
            }
                
            // console.log(`language: ${data.language}`)
            let obj = {};            
            obj.syntax = "Bash";
            obj.sections = [];
            if(data.language == 'dotnet'){
                obj.syntax='Csharp';                
                obj.sections.push(
                    {
                        "header":"Install the library",
                        "code":"dotnet add package Vonage",
                        "keysToReplace":[],
                        "syntax":"Bash"
                    });
            }
            else if(data.language == 'curl'){
                obj.syntax='Bash';                
            }
            else if(data.language == 'java'){
                obj.syntax='java';
                obj.sections.push(
                    {
                        "header":"Install the library",
                        "code":"compile 'com.vonage:client:[6.1.0,7.0.0)'",
                        "keysToReplace":[],
                        "syntax":"Bash"
                    });
            }
            else if(data.language == 'node'){
                obj.syntax='Javascript';
                obj.sections.push(
                    {
                        "header":"Install the library",
                        "code":"npm install @vonage/server-sdk",
                        "keysToReplace":[],
                        "syntax":"Bash"
                    });
            }
            else if(data.language == 'ruby'){
                obj.syntax='Ruby';
                obj.sections.push(
                    {
                        "header":"Install the library",
                        "code":"gem install vonage",
                        "keysToReplace":[],
                        "syntax":"Bash"
                    });
            }
            else if(data.language == 'python'){
                obj.syntax='Python';
                obj.sections.push(
                    {
                        "header":"Install the library",
                        "code":"pip install vonage",
                        "keysToReplace":[],
                        "syntax":"Bash"
                    });
            }
            else if(data.language == 'php'){
                obj.syntax='PHP';
                obj.sections.push(
                    {
                        "header":"Install the library",
                        "code":"composer require vonage/client",
                        "keysToReplace":[],
                        "syntax":"Bash"
                    });
            }
            if (data.import_dependencies){
                let lines = await getLinesFromGithubFile(data.import_dependencies.source, data.import_dependencies.from_line, data.import_dependencies.to_line, language);
                import_section = {"header" : "Import Dependencies", "code" : lines, "keysToReplace":[]}                
                obj.sections.push(import_section);
            }
            if (data.client){
                let lines = await getLinesFromGithubFile(data.client.source, data.client.from_line, data.client.to_line, language, keys_to_replace_client);
                init_section = {
                    "header":"Initialize the library",
                    "code":lines,
                    "keysToReplace":keys_to_replace_client
                }
                obj.sections.push(init_section)
            }
            if(data.code){
                let lines = await getLinesFromGithubFile(data.code.source, data.code.from_line, data.code.to_line, language, keys_to_replace_code);
                code_section = {
                    "header":"Write the code",
                    "code":lines,
                    "keysToReplace":keys_to_replace_code
                };
                obj.sections.push(code_section);
            }
            resolve(obj)
        });
    });
});    
}

async function getLinesFromGithubFile(pathToFile, fromLine, toLine, language, keys_to_replace = []){
    return new Promise(resolve=>{

        url = pathToFile.replace('.repos/','https://raw.githubusercontent.com/');
        url = url.replace('-snippets/', `-snippets/${PRIMARY_BRANCH_NAME}/`);
        
        https.get(url,(response)=>{
            stream = fs.createWriteStream('./out/.tmp')
            response.pipe(stream)
            stream.on("finish",()=>{
                stream.close();
                var f = fs.readFileSync('./out/.tmp', 'utf8').replace("\ufeff", "");
                var lines = f.split("\n").slice(fromLine-1,toLine);
                if(toLine==fromLine){
                    lines = [f.split("\n")[fromLine-1]];                
                }
                
                var ret = '';
                whitespace_to_trim = lines[0].search(/\S/);
                // console.log(whitespace_to_trim)
                lines.forEach((element, index, theArray)=>{
                    ret += element.substring(whitespace_to_trim)+'\n';
                });
                for(k of keys_to_replace){
                    if(language != "curl")
                    {
                        ret = ret.replace(k,"\""+k+"\"");
                    }
                    else{
                        ret = ret.replace("$" + k,k)
                    }
                    
                }
                resolve(ret.substring(0,ret.length-1))
            });
        });
    });
        
}

async function getSnippets(snippetPath, clientKeys, codeKeys){
    let languages = ['csharp', 'curl','java','node','php','python','ruby']
    var output = {};    
    for (const language of languages){        
        the_url = `https://raw.githubusercontent.com/Nexmo/nexmo-developer/main/_examples/${snippetPath}/${language}.yml`
        await getJsonFromCodeSnippet(the_url, language,clientKeys, codeKeys).then(async x=>{
            if(language == "csharp"){
                output["dotnet"] = x;                
            }
            else{
                output[language] = x;
            }            
        })
    }    
    return output;
}

async function buildSnippetJSON(){
    const snippet_file_object = {};
    snippets = [['voice','voice/make-an-outbound-call-with-ncco', ['VONAGE_PRIVATE_KEY_PATH', 'VONAGE_APPLICATION_ID'], ['TO_NUMBER','VONAGE_NUMBER']],['numberInsight','number-insight/advanced',['VONAGE_API_KEY', 'VONAGE_API_SECRET'], ['INSIGHT_NUMBER']],['sms','messaging/sms/send-an-sms',['VONAGE_API_KEY','VONAGE_API_SECRET'],['TO_NUMBER','VONAGE_BRAND_NAME']]]

    for(const snippet of snippets){
        snippets_for_all_languages = await getSnippets(snippet[1], snippet[2],snippet[3]);
        snippet_file_object[snippet[0]] = snippets_for_all_languages;
    }
    snippet_file_object['messages'] = JSON.parse(fs.readFileSync('/app/messages.json','utf8'));
    console.log(snippet_file_object);
    fs.writeFileSync("./examples.json",JSON.stringify(snippet_file_object, null, '\t'))    
}

async function getSnippetForVerify(language){
    let languages = ['csharp', 'curl','java','node','php','python','ruby']
    let verify_snippet_object = {}
    for (language of languages){
        let the_url = `https://raw.githubusercontent.com/Nexmo/nexmo-developer/main/_examples/verify/send-verification-request/${language}.yml`
        let snippet_language = language;
        if(snippet_language == "csharp") // "csharp" is expected as "dotnet" in the dashboard
            snippet_language = "dotnet"
        await getJsonFromCodeSnippet(the_url,language,['VONAGE_API_KEY', 'VONAGE_API_SECRET'], ['RECIPIENT_NUMBER','BRAND_NAME']).then(async (x)=>{
            x.sections[x.sections.length-1].header = "Make a verification request"
            verify_snippet_object[snippet_language]=x
        });
        the_url = `https://raw.githubusercontent.com/Nexmo/nexmo-developer/main/_examples/verify/check-verification-request/${language}.yml`
        await getJsonFromCodeSnippet(the_url,language,[],[]).then(async (x)=>{
            x.sections[x.sections.length-1].header = "Check the request with a code"
            verify_snippet_object[snippet_language]['sections'].push(x['sections'][x['sections'].length-1]);
        });
        the_url = `https://raw.githubusercontent.com/Nexmo/nexmo-developer/main/_examples/verify/cancel-verification-request/${language}.yml`
        await getJsonFromCodeSnippet(the_url,language,[],[]).then(async (x)=>{
            x.sections[x.sections.length-1].header = "Cancel The Request"
            verify_snippet_object[snippet_language]['sections'].push(x['sections'][x['sections'].length-1]);
        });
    }    
    fs.writeFileSync('./examples-verify.json', JSON.stringify(verify_snippet_object, null, '\t'))
}
async function generate(){
    await getSnippetForVerify();
    await buildSnippetJSON();
}
exports.generate = generate;
// start();
