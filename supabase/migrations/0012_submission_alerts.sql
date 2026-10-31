-- Set by the pad-submission-alert function when it emails PAD about a new
-- submission, so each submission alerts once no matter how often it's called.
alter table pad.submissions add column if not exists alerted_at timestamptz;
