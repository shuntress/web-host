# Navigate to the project root from the script's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"/../..
cd $DIR

if [ ! $(basename "$PWD") = web-core ] && [ ! $(basename "$PWD") = web-core-main ]
then
	echo "[ERROR]"
	echo "This script is not meant to be run on it's own."
	echo "Download and extract the project then run the setup from there."
	echo "https://github.com/shuntress/web-core/archive/main.zip"
	exit 1
fi

# confirm node install
printf "node"
if ! type -P node > /dev/null
then
printf "..."
	apt-get install nodejs
fi
echo "✓"

# Generate certificates
# These will work for security purposes but cause a warning in the browser due to being untrusted.
printf "TLS key/cert"
if [ ! -f key.pem ]
then
	printf "..."
	openssl req -newkey rsa:2048 -nodes -keyout administration/key.pem -x509 -days 365 -out administration/certificate.pem
fi
echo "✓"

# Allow the node executable to bind ports 80 and 443 without running as root
printf "Node port access capability..."
setcap CAP_NET_BIND_SERVICE=+ep $(type -p node)
echo "✓"

# Create and fill out the systemd service configuration.
nodepath=$(type -P node)
installpath=$(pwd)
printf "service definition"
if [ ! -d /etc/systemd/system/nodeserver.service ]
then
	printf "..."
	unitFile = /etc/systemd/system/nodeserver.service
	touch $unitFile
	echo "[Unit]" >> $unitFile
	echo "Description=Node.js Server" >> $unitFile
	echo "" >> $unitFile
	echo "[Service]" >> $unitFile
	printf "ExecStart=%s %s/src/site.js" $nodepath $installpath >> $unitFile
	echo "Restart=always" >> $unitFile
	echo "# Restart service after 10 seconds if node service crashes" >> $unitFile
	echo " RestartSec=10" >> $unitFile
	echo " # Output to syslog" >> $unitFile
	echo "StandardOutput=syslog" >> $unitFile
	echo "StandardError=syslog" >> $unitFile
	echo "SyslogIdentifier=nodeserver" >> $unitFile
	echo "" >> $unitFile
	echo "[Install]" >> $unitFile
	echo "WantedBy=multi-user.target" >> $unitFile

	logConf = /etc/rsyslog.d/nodeserver.conf
	touch $logConf
	echo "if \$programname == 'nodeserver' then /var/log/nodeserver.log" > $longConf
	echo "if \$programname == 'nodeserver' then ~" >> $logConf
fi
echo "✓"

echo "Start service..."
systemctl start nodeserver


echo "Done."
echo "Try http://localhost/web-core-about.html"
echo "Request an account with https://localhost/account then check the administration folder."
