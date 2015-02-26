<?php


if (file_exists("segments.json")) {
	$filename = "segments.json";
	$handle = fopen($filename, "r");
	$contents = fread($handle, filesize($filename));
	fclose($handle);
	echo $contents;
} else {
	$filename = "preferences.json";
	$handle = fopen($filename, "r");
	$contents = fread($handle, filesize($filename));
	fclose($handle);
	echo $contents;
}

?>