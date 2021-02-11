### This appends all new account requests to the list
### of authorized users and clears the pending account requests

cat account_creation_requests.txt >> user_credentials.txt
cat /dev/null > account_creation_requests.txt
