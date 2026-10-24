# Error messages

What the user sees, and what produced it. The status code always wins over
keywords in the message (`generation/errors.ts`).

| Shown                                                                                                | Trigger                                                                        | What to do                      |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| Blocked by the content filter. Reword the prompt or try different references.                        | Run ended `nsfw`, or the message mentions moderation / safety / content policy | Reword the prompt               |
| Not enough credits. Top up your Higgsfield account, then try again.                                  | HTTP 402, or the message mentions credits / balance / quota                    | Add credits                     |
| Rate limit reached. Wait a minute, then try again.                                                   | HTTP 429. The queue also pauses for 60 s with a countdown                      | Wait; nothing is lost           |
| Higgsfield rejected your API key. Update it in the key dialog.                                       | HTTP 401 or 403                                                                | Paste a valid key               |
| This model is unavailable right now. Pick another model or try later.                                | HTTP 404 or 503, or the message says the model is unknown                      | Pick another model              |
| Higgsfield had a problem on its side. Try again in a moment.                                         | Any HTTP 5xx                                                                   | Retry                           |
| Higgsfield did not answer in time. Check again in a moment.                                          | The 30 s call timeout (status 408)                                             | Usually fine; the job may exist |
| Could not reach Higgsfield. Check your connection and try again.                                     | Network failure (status 502)                                                   | Check the connection            |
| This app isn't set up yet: the server is missing HF_API_BASE_URL.                                    | Server setting missing                                                         | Set it and restart              |
| Canceled                                                                                             | Run ended `canceled`                                                           |                                 |
| The generation did not produce media                                                                 | `completed` with no media after 3 re-checks                                    | Retry                           |
| Already running, can't cancel / That run was already underway and can't be canceled. It will finish. | Cancel on a job past the queue                                                 | Wait for it                     |
| Too many waiting generations (20). Wait or cancel some.                                              | Local queue full                                                               |                                 |
| A reference file from this run is no longer available                                                | Retry/More-like-this found an expired reference link                           | Add the file again              |
| Browser storage is full or blocked, so recent work may not be saved.                                 | A save failed (quota, private mode)                                            | Export history, delete old runs |
| N saved runs were unreadable and left out.                                                           | Corrupt rows in history                                                        |                                 |

Anything else passes through as the platform wrote it (for example a
validation message). A failed tile also shows a **Support ID** (the platform
request id) to quote to Higgsfield support. **Settings → Recent errors** lists
the last 20 failures with a Retry button.

To add a wording, edit `generation/errors.ts` and a row in
`tests/fixtures/platform-errors.ts`.
