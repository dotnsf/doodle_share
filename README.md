# Doodle Share

## Overview

Social Application, which can share all participant doodles in real time.


## Pre-requisite

- Public application server for Node.js

    - I would describe followings as you use IBM Cloud for this environment.


## Pre-requisite for IBM Cloud user

- Node.js runtime

- IBM Cloudant(Optional)

    - Create one database named **doodleshare**


## Install

- Download source from github.com

    - https://github.com/dotnsf/doodle_share.git

- Edit settings.js with following information:

    - exports.db_username : username for IBM Cloudant

    - exports.db_password : password for IBM Cloudant

    - exports.admin_username : username for Basic Authenticate to access /view and /admin

    - exports.admin_password : password for Basic Authenticate to access /view and /admin

    - exports.defaultroom : default room name when not specified

    - exports.intervalms : default reload interval milliseconds for screen sharing

- Deploy application into IBM Cloud


## How to use

- First, administrator need to access to /view **with Chrome** so that it can handle all client.

    - If you want to specify room name, then access to /view?room=XXXX

- Then user may access to / with their smartphone, and input his/her name.

    - If you want to use room name, then access to /?room=XXXX

- When user draw their doodle in their smartphone, all doodles would be shown in /view screen.

    - (Optional)User can **save** their doodle, if Cloudant is ready.

- When administrator access to /admin, they can view all saved images.


## Audios

Ogg files are download from [魔王魂](https://maou.audio/rule/).


## Copyright

2019-2020 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
