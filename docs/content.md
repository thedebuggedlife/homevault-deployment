# Migrating Existing Content

You may have existing content available in the cloud which you want to make accessible from the applications installed on your server. For example, you may want to migrate photos and videos from iCloud to Immich, or documents from OneDrive to NextCloud.

This section will give you a quick overview of steps you can take to perform the migration. If your cloud provider is not listed in this section, you may need to look for guidance on how to retrieve your information from their online documentation.

## Downloading Content From the Cloud

### Google Drive for Desktop (documents only)

If you use Google Drive on for Desktop on your Mac or Windows computer, you can enable file-mirroring to have the Drive software download all files from the cloud to your computer for offline access. Use this method for documents only. For photos and videos, you should use Google Takeout as shown in the section below. This is because Google Takeout exports additional metadata about your photos which can be imported into Immich.

To make all your cloud files available offline using Drive for Desktop:

1. Open Drive for Desktop
2. Click on Settings ⚙️ > **Preferences**
3. On the left, click Folders from Drive
4. Under "My Drive syncing options," select **Mirror files**
5. Close Drive for desktop

### Google Takeout (documents and photos)

You can export your photos and videos from Google using the [Google Takeout](https://takeout.google.com) tool. You can also use this method as an alternative to export documents stored on your Google Drive, if you prefer it over using Drive for Desktop, as outlined in the previous section.

1. Open [Google Takeout](https://takeout.google.com) on a web browser
2. Make sure you are signed into Google with the account that has the data you want to migrate to the server
3. Unselect all content first (using the link available at the top of the tool)
4. Select the options for **Drive**  and **Photos** only, then click **Next**
5. Select **Send download link via email** as Destination
6. Select **Export once** as Frequency
7. Select **ZIP** as File Type
8. You can keep the File Size at **2GB**. Choosing a larger size may be convenient if you have a lot of content.
9. Click **Create export**

A few days later you should receive an email with a series of download links from Google. Download all the files to your computer.

### Google Workspace (documents only)

If you want to migrate documents from Google Workspace to use from NextCloud on your server, follow the steps provided by this guide to download the data to your computer: https://support.google.com/a/answer/14339894

### iCloud Drive (documents only)

You can use Mac's built-in Drive software to make all your documents available offline, in preparation to migrate them to the server. To do this, check out the [iCloud Drive User Guide](https://support.apple.com/guide/mac-help/work-with-folders-and-files-in-icloud-drive-mchl1a02d711/mac) and take the steps outlined under the following sections:

- Download items stored only in iCloud Drive to your Mac
- Keep items downloaded on your Mac

### iCloud Data and Privacy (documents only)

You can request a copy of all your iCloud data from Apple for download, using their Data and Privacy tool. You can use this method as an alternative to iCloud Drive. This may be convenient if you no longer use a Mac computer, for example.

This method is not recommended for exporting Photos because it does not preserve all the metadata available and in some cases may lose important information (such as timestamps or GPS coordinates). To export photos and videos, see the following section.

To request a copy of all your iCloud data for download:

1. Navigate to the [Data and Privacy](https://privacy.apple.com/) page on Apple's website and sign in with your Apple ID account.
2. Click the link under the section named **Get a copy of your data**
3. Make sure the checkbox for **iCloud Drive files and documents** is selected
4. Click on **Continue** at the bottom of the screen.
5. Choose a file size for download. If you have a lot of data available in iCloud, choose a larger file size. The option **5GB** may be an ideal size for most people.
6. Click on **Complete request**

A few days later you should receive an email with a series of download links from Google. Download all the files to your computer.

### Photos App on iPhone (photos only)

You are only be able to use this option if your phone has enough capacity to store all your iCloud photos on the device. If your photo collection is larger than what can be stored on your device, you will need to use the option in the next section.

1. On your iPhone, tap Settings > [your name] > iCloud > Photos
2. Then, select Download and Keep Originals

Your photos should download to your phone. After installing Immich on your server, you will be able to upload all photos using the Immich app on your phone.

### iCloud Photo Exporter (photos only)

If you are unable to use the Photos App on iPhone (for example, if you have switched to an Android phone but still have photos stored in iCloud), you can use the tool called [iCloud Photos Downloader](https://icloud-photos-downloader.github.io/icloud_photos_downloader/). I recommend this tool over other export methods because it downloads metadata about your photos as well, which isn't normally exported when using iCloud Drive or Data and Privacy exports.

To download a copy of all your photos from iCloud using this tool:

1. Download the version of the tool that matches your OS (Windows or Mac) from the [Releases page](https://github.com/icloud-photos-downloader/icloud_photos_downloader/releases). Or use the following links for quick access:
    a. For Windows: [download link](https://github.com/icloud-photos-downloader/icloud_photos_downloader/releases/download/v1.27.4/icloudpd-1.27.4-windows-amd64.exe)
    b. For MacOS: [download link](https://github.com/icloud-photos-downloader/icloud_photos_downloader/releases/download/v1.27.4/icloudpd-1.27.4-macos-amd64)
2. Open a Command Line (Windows) or a Terminal (Mac), navigate to the folder where you downloaded the file, and run the tool.

Examples:

_Windows_
```bat
mkdir %HOMEPATH%\photo-export
cd %HOMEPATH%\Downloads
icloudpd-1.27.4-windows-amd64.exe -d "%HOMEPATH%\photo-export" -u your_apple_id -p your_apple_password 
```

_Mac_
```bash
mkdir ~/photo-export
cd ~/Downloads
chmod +x icloud-1.27.4-macos-amd64
icloudpd-1.27.4-macos-amd64 -d ~/photo-export -u your_apple_id -p your_apple_password 
```

Your iCloud photos are now available on the `photo-export` folder.

### OneDrive for Desktop (documents and photos)

If you use OneDrive for Desktop, you can configure it to keep a copy of all your documents and photos available offline. To do this:

_On Windows:_

1. Click the OneDrive cloud icon in your notification area
2. Select the OneDrive ⚙️ Settings icon, then **Settings**
3. Go to the **Sync and back up** tab and expand the **Advanced settings**
4. Under Files On-Demand, select **Download all files**

_On Mac:_

1. Click on the OneDrive icon on the notification bar (top of the screen)
2. Click on the ⚙️ (gear) icon, then select **Preferences**
3. Under "Files On-Demand (Advanced)", click on **Download all OneDrive files now**

_Alternative:_

If you only want to download a small subset of OneDrive folders to import into your server:

1. Navigate to the file or folder you want to download on File Explorer (Windows) or Finder (Mac)
2. Right-click the item and select **Always keep on this device**

## Importing Content to the Server

> 🛠️ If you are participating on the Server Workshop, we will be performing this step as part of the workshop.

TBD.