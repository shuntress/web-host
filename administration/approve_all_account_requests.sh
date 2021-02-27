### This appends all new account requests to the list
### of authorized users and clears the pending account requests

cd $(dirname $0)
cat account_creation_requests.txt >> user_credentials.txt
rm account_creation_requests.txt
