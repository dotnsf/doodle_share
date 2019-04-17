# Doodle Share

## Overview

Social Application, which can share all participant doodles in real time.


## Pre-requisite

- Public application server for Node.js

    - I would describe followings as you use IBM Cloud for this environment.


## Pre-requisite for IBM Cloud user

- Node.js runtime

- IBM Cloudant

    - Create one database named **doodleshare**


## Install

- Download source from github.com

    - https://github.com/dotnsf/doodle_share.git

- Edit settings.js with following information:

    - exports.db_username : username for IBM Cloudant

    - exports.db_password : password for IBM Cloudant

    - exports.admin_username : username for Basic Authenticate to access /view and /admin

    - exports.admin_password : password for Basic Authenticate to access /view and /admin

- Deploy application into IBM Cloud


## How to use

- First, administrator need to access to /view so that it can handle all client.

- Then user may access to /?name=(username) with their smartphone. username can be duplicated, but we need to distinguish from them.

- When user draw their doodle in their smartphone, all doodles would be shown in /view screen.

    - User can **save** their doodle, if they want.

- When administrator access to /admin, they can view all saved images.


## Copyright

2019 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.

