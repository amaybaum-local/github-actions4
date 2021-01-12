const os = require("os"),
    fs = require("fs"),
    path = require("path"),
    https = require("https"),
    xml2js = require("xml2js"),
    parseString = require("xml2js").parseString,
    spawnSync = require("child_process").spawnSync;

class Action{
    constructor(){
        this.projectFile = process.env.PROJECT_FILE;
        this.packageName = process.env.PACKAGE_NAME;
        this.version = process.env.TAG.substring(1);
        this.branch = process.env.BRANCH;
        this.organization = process.env.ORGANIZATION;
        this.repo = process.env.REPO;
        this.tag = process.env.TAG;
        this.nuget_api_key = process.env.NUGET_API_KEY;
        this.github_user_name = process.env.GITHUB_USER_NAME;
        this.github_email = process.env.GITHUB_EMAIL;
        this._executeCommand(`git config --global user.name "${this.github_user_name}"`);
        this._executeCommand(`git config --global user.email "${this.github_email}"`);
        this._executeCommand(`git config --global github.token ${process.env.GITHUB_TOKEN}`);
    }

    _executeCommand(cmd, options) {
        console.log(`executing: [${cmd}]`)
        let ops = {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'pipe',
            encoding: 'utf-8'            
        };
        const INPUT = cmd.split(" "), TOOL = INPUT[0], ARGS = INPUT.slice(1)        
        console.log(String(spawnSync(TOOL, ARGS, ops).output));
    }

    _executeCommandWithArgs(cmd, args){
        console.log(`executing: [${cmd}]`)
        let ops = {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'pipe',
            encoding: 'utf-8'            
        };
        console.log(String(spawnSync(cmd, args, ops).output));
    }

    _runRelease(){
        fs.readFile(this.projectFile,"utf-8", (err, data)=>{
            if(err) {
                console.log(err);                
            }
            else {
                parseString(data, (err,result)=>{
                    if(err) {
                        console.log(err);                        
                    }                
                    else{
                        let json = result;
                        console.log(json.Project.PropertyGroup);
                        json.Project.PropertyGroup[0].Version[0] = this.version;
                        json.Project.PropertyGroup[0].PackageReleaseNotes[0]=`https://github.com/${this.organization}/${this.repo}/releases/tag/v${this.version}`
                        var builder = new xml2js.Builder();
                        var xml = builder.buildObject(json);
                        fs.writeFile(this.projectFile, xml, (err,res)=>{
                            if (err) console.log(err);
                            else {
                                console.log("Successfully wrote out to xml file");
                                this._executeCommand(`git add ${this.projectFile}`);
                                this._executeCommandWithArgs(`git`, ["commit", "-m", `'Bumping version to ${this.version}'`]);
                                this._executeCommand(`git push`);
                                this._executeCommand(`git tag -f ${this.tag}`);
                                this._executeCommand(`git push origin ${this.tag} --force`);
                                this._executeCommand(`dotnet build -c Release ${this.projectFile}`);
                                this._executeCommand(`dotnet pack -c Release ${this.projectFile}`);
                                this._executeCommand(`dotnet nuget push bin/Release/*.${this.version}.nupkg -s https://api.nuget.org/v3/index.json -k ${this.nuget_api_key}`)
                            }
                        });
                    }                    
                });
            }
        })
    }    
    run(){
        console.log("Hello world");
        if (!fs.existsSync(this.projectFile)){            
            console.log("File not Found")            
        }
        else{
            this._runRelease(); 
        }
    }
}
new Action().run();