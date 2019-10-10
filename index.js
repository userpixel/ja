#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const fetch = require('node-fetch')
const dotenv = require('dotenv')
const { whereFrom } = require('./wherefrom.js')
const { getConfig } = require('./config.js')

dotenv.config({ debug: process.env.DEBUG })

const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)

function getToken(source) {
    const { hostname } = new URL(source)
    const envVarName = hostname.toUpperCase().replace(/[.:]/g, '_') + '_TOKEN'
    const token = process.env[envVarName]
    if (token) {
        console.log(`Using the token stored in $${envVarName} for ${hostname}`)
        return token
    } else {
        console.info(`Not using a token for ${hostname}`)
    }
}

function fetchFiles(config) {
    return Promise.all(config.map(async ({ source, localFilePath }) => {
        const translatedSource = whereFrom(source)
        const token = getToken(source)
        const headers = {}
        if (token) {
            headers['Authorization'] = `token ${token}`
        }
        const response = await fetch(translatedSource, { headers })
        if (!response.ok) {
            throw new Error(`Failed to fetch ${source} from ${translatedSource}. Error: ${response.status} ${response.statusText}`)
        }
        console.log(`Fetched ${source}`)
        return {
            source,
            localFilePath,
            contents: await response.text()
        }
    }))
}

function writeFiles(config) {
    return Promise.all(config.map(async ({ localFilePath, contents }) => {
        const dir = path.dirname(localFilePath)
        if (dir !== '.') {
            console.log(`Creating dir ${dir}...`)
            await mkdir(dir, { recursive: true })
        }
        console.log(`Writing file ${localFilePath}...`)
        return writeFile(localFilePath, contents)
    }))
}

async function main() {
    const config = await getConfig()
    if (config.length === 0) {
        console.log(`Empty config! Nothing to do here!`)
        return
    }
    console.table(config)
    await writeFiles(await fetchFiles(config))
}

module.exports = { main }