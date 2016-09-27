OUTPUT=$(echo $1 | sed 's/\(.*\)\.\(.*\)$/\1.chrome.\2/g')
# '"'"' -> is to escape single quote inside single quote
sed 's/\(url('"'"'\)\.\./\1chrome-extension:\/\/__MSG_@@extension_id__/g' $1 > $OUTPUT
