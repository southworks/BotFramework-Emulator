echo Pack releases
cd ./packages/app/main/

npm version $TRAVIS_TAG

gulp stage:linux
gulp redist:linux

gulp stage:windows
gulp redist:windows-nsis:binaries

gulp stage:mac
gulp redist:mac:binaries

cd ./dist/

echo Files to dist

ls -R

for filename in *; do
  echo $filename
done
