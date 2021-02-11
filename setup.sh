
printf "git"
if ! type -P git > /dev/null
then
	printf "..."
  apt-get install git
fi
echo "✓"

printf "node"
if ! type -P node > /dev/null
then
printf "..."
	apt-get install nodejs
fi
echo "✓"

printf "web-core"
if [ ! -d web-core ]
then
printf "..."
  git clone https://github.com/shuntress/web-core.git
fi
echo "✓"

cd web-core 

printf "TLS key/cert"
if [ ! -f key.pem ]
then
	printf "..."
	openssl req -newkey rsa:2048 -nodes -keyout administration/key.pem -x509 -days 365 -out administration/certificate.pem
fi
echo "✓"

# Allow the node executable to bind port 80 and 443 without running as root
printf "Node port access capability..."
setcap CAP_NET_BIND_SERVICE=+ep $(type -p node)
echo "✓"

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
