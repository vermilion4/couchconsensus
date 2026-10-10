# CouchConsensus: Requirements

Oct 10, 2026 · @Ady

## Overview

CouchConsensus ends the "what should we watch?" argument in under three minutes. The TV shows a QR code, everyone swipes yes or no on their own phone, and the TV announces one pick and where to stream it.

| Item | Decision |
| --- | --- |
| Hackathon track | Fire TV, built for Vega OS in React Native |
| Test device | Vega Virtual Device on a MacBook, no Fire TV hardware |
| Priority categories | Multi-modal UX, family entertainment, AI-enhanced viewing |
| Mini challenge | AWS Builder, through Amazon Bedrock and AWS hosting |
| Submission deadline | Oct 23, 2026, 3:00pm EDT |

The product succeeds when three things are true:

- A room of 2 to 6 people reaches one pick in under 3 minutes.
- Nobody installs an app or creates an account on their phone.
- The whole flow runs on the Vega Virtual Device and fits a demo video under 3 minutes.

## Problem and evidence

Choosing what to watch takes too long because the TV has one remote and one profile, while the room has several opinions.

- **Browsing is the complaint.** An Accenture survey found viewers frustrated with browsing app by app, and wanting recommendations that span all their services ([TechHive, 2022](https://www.techhive.com/article/605810/4-ways-cord-cutters-can-resolve-streaming-frustrations.html)).
- **The home screen got busier.** After the 2026 Fire TV redesign, the recently used apps list sits 11 rows down. Users report too many ads and a cluttered layout ([TROYPOINT, March 2026](https://troypoint.com/amazon-fire-tv-interface-gets-biggest-update/)).
- **Existing tools assume one decider.** Universal search and watchlists help once you know the title. They do not settle a disagreement between people on the same sofa.

The gap we target: no step between "TV on" and "title chosen" gives every person in the room an equal, private say.

## Users

Four people matter: the host with the remote, the voters on phones, the late joiner, and the hackathon judge watching the video. Rooms are designed for 2 to 6 voters and support up to 8.

| Role | Device | Wants | Must never happen |
| --- | --- | --- | --- |
| Host | TV remote | Start fast, stay in control, end the round | Waiting on one slow voter |
| Voter | Own phone | A real say without arguing out loud | Installing an app, making an account, or having votes exposed |
| Late joiner | Own phone | Jump in mid-round | Restarting the round for everyone |
| Judge | Demo video | See TV and phones working together in under 3 minutes | Doubt about what runs on Fire TV |

## Ideal experience

The finished product feels like a quick party game that always ends with something to watch. Seven principles define it.

1. **Three minutes, start to pick.** A 90-second voting timer keeps the whole session short.
2. **Nothing to install.** Phones join in a browser from the QR code, with a nickname and no account.
3. **Votes are private.** The TV shows who has finished, never who voted for what.
4. **The TV is the scoreboard, the phone is the controller.** Nobody types with the remote.
5. **Always one answer.** Every round ends in exactly one pick, with no ties and no "no match".
6. **The referee explains itself.** One sentence says why this title won.
7. **It has a personality.** A whistle, a coin toss and a verdict, kept short.

## User stories

Twelve stories cover the full session, each with the test that proves it is done.

| ID | As a | I want to | Done when |
| --- | --- | --- | --- |
| US-1 | Host | start a room from the TV with one press | The lobby with QR code and 4-letter room code shows within 2 seconds |
| US-2 | Host | set ground rules with the remote: services we have, maximum runtime, film or series | Every card in the deck obeys the rules, and defaults work with no changes |
| US-3 | Voter | join by scanning the QR code and typing a name | My name appears on the TV within 1 second, with no install or account |
| US-4 | Voter | swipe yes or no on each card | Each vote registers once, and I can undo the last card |
| US-5 | Voter | spend one veto and one super-yes per round | A vetoed title cannot win, and a super-yes counts double |
| US-6 | Voter | pick or type a mood before voting | The deck reflects the room's moods, and skipping still works |
| US-7 | Room | watch progress on the TV without seeing votes | The TV shows each name, cards done, and a countdown |
| US-8 | Host | end the round early | Pressing OK counts the votes cast so far and moves to the verdict |
| US-9 | Room | get exactly one pick with a reason | The verdict shows title, runtime, where to watch, and a one-sentence reason |
| US-10 | Host | ask for the runner-up or a rematch | Runner-up shows the next ranked title, and Rematch deals a fresh deck without rejoining |
| US-11 | Late joiner | join after voting has started | I get the same deck, and my votes count if I finish before the round ends |
| US-12 | Voter | lock or drop my phone without breaking the room | Reopening the page restores my place, and the round never waits past the timer |

## User flow

A session runs from launch to verdict in ten steps, split between the TV and each voter's phone.

&#91;embedded content: user flow · 10 steps, 2 decisions\]

Read it top to bottom: the left lane is the TV, the right lane is a phone. Every branch reaches the verdict, so a round can never end without a pick.

## Screens

The product is four TV screens and five phone screens. The storyboard shows the three moments that matter, and the table lists every screen.

&#91;embedded content: screen storyboard · join, vote, verdict\]

These are wireframes, not final visuals. Names, the room code and "Service A" are placeholders.

| Screen | Device | Shows | Actions |
| --- | --- | --- | --- |
| Home | TV | App name and one button | Start a room |
| Lobby | TV | QR code, room code, joined names, ground rules | Edit rules, Start |
| Scoreboard | TV | Countdown and each voter's progress | OK ends the round early |
| Verdict | TV | Winning title, runtime, where to watch, the reason | Runner-up, Rematch, Done |
| Join | Phone | Room code and a name field | Join |
| Mood | Phone | Mood chips and a free-text box | Pick, type, or skip |
| Swipe | Phone | One card at a time and the card count | Yes, No, Veto, Super-yes, Undo |
| Waiting | Phone | A prompt to look up at the TV | None |
| Result | Phone | The pick and how I voted on it | None |

## Functional requirements

Sixteen requirements are Must and define the submission. Should items make it competitive, and Could items are cut first.

| ID | Requirement | Priority |
| --- | --- | --- |
| TV-1 | Runs on Vega OS and is fully usable with D-pad, OK and Back | Must |
| TV-2 | Creates a room and shows a QR code plus a 4-letter room code | Must |
| TV-3 | Lobby lists joined voters live, and Start unlocks at 2 voters | Must |
| TV-4 | Scoreboard shows the countdown and each voter's progress, never vote values | Must |
| TV-5 | Verdict shows title, runtime, genre, where to watch, and the reason | Must |
| TV-6 | Runner-up and Rematch from the verdict screen | Should |
| TV-7 | Ground rules editor: services, maximum runtime, film or series | Should |
| TV-8 | Sound and motion for the verdict: whistle, coin toss | Should |
| TV-9 | Open the chosen title's streaming app from the verdict | Should |
| PH-1 | Opens in a mobile browser from the QR link, with no install or login | Must |
| PH-2 | Join with a name, and return to the same seat after a refresh or screen lock | Must |
| PH-3 | Swipe or tap Yes or No through a 15-card deck, with undo for the last card | Must |
| PH-4 | Shows the final pick | Must |
| PH-5 | One veto and one super-yes per voter per round | Should |
| PH-6 | Mood input: chips plus optional free text | Should |
| SV-1 | Rooms hold 2 to 8 voters and expire after 24 hours | Must |
| SV-2 | Pushes room state to the TV and every phone within 1 second | Must |
| SV-3 | Ends the round when all voters finish, the 90-second timer ends, or the host calls it | Must |
| SV-4 | Applies the referee rules and returns a ranked list | Must |
| SV-5 | Builds the deck from the title catalog and the ground rules | Must |
| SV-6 | Demo mode: a fixed deck with no third-party posters, logos or service names | Must |
| SV-7 | Remembers whose super-yes won last time, to break future ties | Could |
| AI-1 | Amazon Bedrock turns the room's moods into catalog filters and a shortlist | Should |
| AI-2 | Amazon Bedrock writes the one-sentence reason from the vote tally | Should |
| AI-3 | If Bedrock takes over 3 seconds or fails, use a rule-based deck and a template reason | Must |

AI-1 or AI-2 must ship to enter the AWS Builder mini challenge.

## How the referee decides

Fixed rules pick the winner. AI only shapes the deck and words the verdict, so every result can be explained and tested.

| Vote | Effect | Limit |
| --- | --- | --- |
| Yes | 1 point | None |
| Super-yes | 2 points | 1 per voter per round |
| No | 0 points | None |
| Veto | Removes the title for everyone | 1 per voter per round |
| Not reached | Counts as No | None |

Ranking runs in this order:

1. Remove every vetoed title.
2. Titles that every voter said yes to rank first.
3. Within each group, more points rank higher.
4. Ties break by fewer No votes, then more super-yes votes, then a coin toss shown on the TV.
5. If no surviving title has a yes, run sudden death: 5 new cards, no vetoes, top score wins.

A worked example with three voters:

| Title | Sam | Ada | Kofi | Outcome |
| --- | --- | --- | --- | --- |
| Film A | Yes | Super-yes | No | 3 points, not unanimous |
| Film B | Yes | Yes | Yes | 3 points, unanimous, wins |
| Film C | Super-yes | Veto | Yes | Removed by veto |

## System architecture

One small service on AWS sits between the TV app and every phone. It owns the room, the votes and the referee rules, so the TV and phones stay thin.

&#91;embedded content: architecture · 2 clients, 1 service, 3 dependencies\]

A room moves through four states: lobby, voting, sudden death (only when needed), verdict.

| Piece | Proposed choice | Why |
| --- | --- | --- |
| TV app | React Native for Vega | The track's platform, and it runs on the virtual device |
| Phone app | A single web page served by the session service | No install, opens from a QR link |
| Session service | Node.js with WebSocket, hosted on AWS | One language across TV, phone and server |
| Room store | Amazon DynamoDB with time-to-live | Rooms delete themselves after 24 hours |
| AI | Amazon Bedrock | Qualifies for AWS Builder |
| Title catalog | A fixed JSON deck for demo mode, a licensed title API for real mode | Keeps the video free of third-party artwork |

## Non-functional requirements and constraints

The app must feel instant, protect votes, and work without any Fire TV feature the virtual device lacks.

| Area | Requirement |
| --- | --- |
| Speed | Lobby in 2 seconds, a vote reflected on the TV in 1 second, verdict within 3 seconds of round end |
| TV usability | Text readable from across the room, a visible focus state, every screen usable with D-pad only |
| Phone support | Current iOS Safari and Android Chrome, portrait, one-handed |
| Privacy | No accounts, only a nickname stored, room data deleted after 24 hours, individual votes never displayed |
| Resilience | A dropped phone never blocks the round, and the TV restores the room after a reconnect |
| Content | Adult-rated titles excluded by default, and nicknames limited to 12 characters |

Three platform constraints shape the design:

- **The virtual device is limited.** It supports only in-app purchasing, DRM and WebView on M-series Macs. Launcher, Login with Amazon and other Fire TV APIs are not supported, and it is not for performance testing ([Amazon Vega docs](https://developer.amazon.com/docs/vega/0.23/run-apps-overview)). So the app is self-contained, and TV-9 cannot be shown in the demo.
- **Setup needs a few tools.** The Vega Developer Tools on macOS need Homebrew, Node.js 18 or later and VS Code, and install Rosetta 2 on Apple Silicon ([install guide](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk)).
- **The video has content rules.** The hackathon bars third-party trademarks and copyrighted footage without permission, which is why demo mode (SV-6) is a Must.

## Scope and 13-day plan

The core loop must work end to end by Oct 17, leaving six days for AI, polish and the video.

&#91;embedded content: build plan · Oct 10 to Oct 23\]

Service and TV work overlap on Oct 14 and 15, when the two first connect.

| Tier | What is in |
| --- | --- |
| Core, by Oct 17 | Rooms, QR join, 15-card swipe, scoreboard, rule-based verdict, demo deck, all running on the virtual device |
| Competitive, by Oct 21 | Bedrock moods and verdict line, veto and super-yes, ground rules, runner-up and rematch |
| If time allows | Sound and motion, tie-break memory, a real title catalog |
| Out of scope | Opening streaming apps, accounts, watch history, native phone apps, voice control |

IMPORTANT: Keep a friction log file from the start and document the task you attempted, the steps you took, what you expected vs. what actually happened, a severity rating, any workaround you used, and an actionable suggestion.

## Submission checklist

Every item below comes from the hackathon rules, and the first six are required.

- [ ] Text description of what the project does and how it works
- [ ] GitHub repo with all source, assets and run instructions: public with an open-source licence, or private and shared with testing@devpost.com and the Amazon reviewers
- [ ] Demo video under 3 minutes, public on YouTube or Vimeo, in English, showing the app on the Vega Virtual Device
- [ ] No third-party trademarks, posters or music in the video
- [ ] Product feedback on every tool used: Vega tools, the virtual device, Bedrock and other AWS services
- [ ] Entry marked as Fire TV track plus AWS Builder, with the AWS integration documented
- [ ] Optional: a friction log kept daily, worth up to a 10% judging bonus
- [ ] Optional: feature requests with urgency ratings

## Risks and open questions

The biggest risk is unknown platform support, so the first two days test it before any feature work.

| Risk | What breaks | Fallback |
| --- | --- | --- |
| Vega's React Native lacks a working WebSocket | TV cannot sync live | Poll the service over HTTPS once a second |
| No QR library runs on Vega | TV cannot show a QR code | Render the QR on the server as an image, or show the room code and a short link |
| Third-party artwork or names appear in the video | Rule breach | Demo deck with original placeholder art and invented service names |
| Bedrock responds slowly | The verdict stalls | 3-second timeout, then the template reason (AI-3) |
| Thirteen days is tight for one builder | Unfinished submission | Core tier locked by Oct 17, later tiers cut in order |
| A similar group-picker app already exists | Lower idea score | Lead with the TV scoreboard and the explained verdict |

Open questions to settle before building:

- [ ] Films only for the first version, or series too? - start with films only for v1
- [ ] Which title API feeds real mode, and do its terms allow hackathon use? - I am thinking prime video API, but suggest if better with larger collection.
- [ ] Which country's streaming availability does the verdict show? - It should be based on the country of location, suggest other possibilities
- [ ] Which Bedrock model, and is it enabled in the AWS account? - none chosen yet, suggest
- [ ] Does the Amazon Appstore already have a group-decision app for Fire TV? No they do not
