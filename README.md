[![MIT License](https://img.shields.io/github/license/danzelbel/xray-beams)](https://github.com/danzelbel/xray-beams/blob/master/LICENSE)
[![Version](https://vsmarketplacebadge.apphb.com/version/danzelbel.xray-beams.svg)](https://marketplace.visualstudio.com/items?itemName=danzelbel.xray-beams)
![Build](https://github.com/danzelbel/xray-beams/workflows/build/badge.svg)
![Release](https://github.com/danzelbel/xray-beams/workflows/release/badge.svg)

# Xray Beams

Xray test management integration for vscode

## Features

![features](images/readme/features.gif)

- Manage Xray folders
- View tests as feature scenarios
- Manage tests
- View Orphans
- View Pre-Conditions
- Detect feature problems

## Extension Settings

![Settings](images/readme/settings.gif)

This extension contributes the following settings:

### Required
- `xrayBeams.jira.baseUrl`
- `xrayBeams.jira.projectKey`
- `xrayBeams.jira.username`

### Optional
- `xrayBeams.jira.jql.orphans`: The Orphans "JQL Search" filter
- `xrayBeams.jira.jql.preConditions`: The Additional jql filter for pre-conditions

## Known Issues

-

## Release Notes

### 2020.7.3

Initial release of Xray Beams extension